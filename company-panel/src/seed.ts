const seedStructure = async () => {
  const roleService = strapi.admin.services.role;
  const userService = strapi.admin.services.user;

  strapi.log.info('[seed] Starting structure seed...');

  const role = await roleService.findOne({ name: 'Website Admin' });
  const websiteAdminRole =
    role ??
    (await roleService.create({
      name: 'Website Admin',
      description: 'Manages content of the NGO websites assigned to them.',
    }));

  const websiteAdminRoleId = websiteAdminRole.id;

  const admins = [
    { firstname: 'Website', lastname: 'Admin A', email: 'admina@ngosites.in', password: 'Ngo@123456' },
    { firstname: 'Website', lastname: 'Admin B', email: 'adminb@ngosites.in', password: 'Ngo@123456' },
    { firstname: 'Website', lastname: 'Admin C', email: 'adminc@ngosites.in', password: 'Ngo@123456' },
  ];

  const adminUsers: Record<string, number> = {};
  for (const a of admins) {
    const existing = await userService.exists({ email: a.email });
    let user = existing ? await userService.findOne({ email: a.email }) : null;
    if (!user) {
      user = await userService.create({
        ...a,
        isActive: true,
        registrationToken: null,
        roles: [websiteAdminRoleId],
      });
      strapi.log.info(`[seed] Created admin user ${a.email}`);
    } else {
      await userService.updateById(user.id, { roles: [websiteAdminRoleId] });
    }
    adminUsers[a.email] = user.id;
  }

  const websiteService = strapi.documents('api::website.website');

  const websites = [
    { name: 'NGO-1', slug: 'ngo-1', admins: [adminUsers['admina@ngosites.in']] },
    { name: 'NGO-2', slug: 'ngo-2', admins: [adminUsers['admina@ngosites.in']] },
    { name: 'NGO-3', slug: 'ngo-3', admins: [adminUsers['adminb@ngosites.in']] },
    { name: 'NGO-4', slug: 'ngo-4', admins: [adminUsers['adminb@ngosites.in']] },
    { name: 'NGO-5', slug: 'ngo-5', admins: [adminUsers['adminc@ngosites.in']] },
    { name: 'NGO-6', slug: 'ngo-6', admins: [adminUsers['adminc@ngosites.in']] },
  ];

  const websiteIds: Record<string, string> = {};
  for (const w of websites) {
    const existing = await websiteService.findFirst({ filters: { slug: w.slug } });
    if (existing) {
      await websiteService.update({
        documentId: existing.documentId,
        data: { admins: { set: w.admins.map((id) => ({ id })) } },
        status: 'draft',
      });
      websiteIds[w.slug] = existing.documentId;
      strapi.log.info(`[seed] Website ${w.slug} already exists, admins updated`);
    } else {
      const created = await websiteService.create({
        data: {
          name: w.name,
          slug: w.slug,
          domain: `${w.slug}.example.com`,
          admins: { connect: w.admins.map((id) => ({ id })) },
        },
      });
      await websiteService.publish({ documentId: created.documentId });
      websiteIds[w.slug] = created.documentId;
      strapi.log.info(`[seed] Created website ${w.slug}`);
    }
  }

  const pageService = strapi.documents('api::page.page');
  const sectionService = strapi.documents('api::section.section');

  const demoPage = await pageService.findFirst({ filters: { slug: 'home' } });
  let homePage = demoPage;
  if (!homePage) {
    homePage = await pageService.create({
      data: {
        title: 'Home',
        slug: 'home',
        isHome: true,
        order: 0,
        website: { documentId: websiteIds['ngo-1'] },
      },
    });
    await pageService.publish({ documentId: homePage.documentId });
  }

  const existingSections = await sectionService.findMany({
    filters: { page: { documentId: { $eq: homePage.documentId } } },
  });
  if (existingSections.length === 0) {
    const demo = [
      { type: 'hero', heading: 'Welcome to NGO-1', subheading: 'Serving communities since 2010', text: '', order: 1 },
      { type: 'stats', heading: 'Our impact', subheading: '', text: '', order: 2 },
      { type: 'gallery', heading: 'Gallery', subheading: '', text: '', order: 3 },
      { type: 'contact', heading: 'Contact us', subheading: '', text: '', order: 4 },
    ] as const;
    for (const s of demo) {
      const sec = await sectionService.create({
        data: { ...s, page: { documentId: homePage.documentId } },
      });
      await sectionService.publish({ documentId: sec.documentId });
    }
    strapi.log.info('[seed] Created demo sections for NGO-1 home page');
  }

  const scope = {
    website: 'admin::website-assigned-to-admin',
    page: 'admin::page-belongs-to-assigned-website',
    section: 'admin::section-belongs-to-assigned-website',
  };

  const permissions = [
    { action: 'plugin::content-manager.explorer.read', subject: 'api::website.website', conditions: [scope.website] },
    { action: 'plugin::content-manager.explorer.read', subject: 'api::page.page', conditions: [scope.page] },
    { action: 'plugin::content-manager.explorer.create', subject: 'api::page.page', conditions: [scope.page] },
    { action: 'plugin::content-manager.explorer.update', subject: 'api::page.page', conditions: [scope.page] },
    { action: 'plugin::content-manager.explorer.read', subject: 'api::section.section', conditions: [scope.section] },
    { action: 'plugin::content-manager.explorer.create', subject: 'api::section.section', conditions: [scope.section] },
    { action: 'plugin::content-manager.explorer.update', subject: 'api::section.section', conditions: [scope.section] },
    { action: 'plugin::content-manager.explorer.delete', subject: 'api::section.section', conditions: [scope.section] },
    { action: 'plugin::content-manager.explorer.publish', subject: 'api::section.section', conditions: [scope.section] },
    { action: 'plugin::upload.read' },
    { action: 'plugin::upload.assets.create' },
    { action: 'plugin::upload.assets.update' },
    { action: 'plugin::upload.assets.download' },
    { action: 'plugin::upload.assets.copy-link' },
  ];

  await roleService.assignPermissions(websiteAdminRoleId, permissions);
  strapi.log.info('[seed] Website Admin permissions assigned');

  strapi.log.info('[seed] Structure seed completed.');
};

export default seedStructure;
