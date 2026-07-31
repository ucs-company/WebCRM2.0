const registerWebsiteScopeConditions = async () => {
  const { conditionProvider } = strapi.admin.services.permission;

  await conditionProvider.registerMany([
    {
      displayName: 'Belongs to an assigned website',
      name: 'website-assigned-to-admin',
      category: 'Website scope',
      plugin: 'admin',
      handler: (user: { id: number }) => ({
        admins: { id: { $in: [user.id] } },
      }),
    },
    {
      displayName: 'Belongs to a website assigned to the admin',
      name: 'page-belongs-to-assigned-website',
      category: 'Website scope',
      plugin: 'admin',
      handler: (user: { id: number }) => ({
        website: { admins: { id: { $in: [user.id] } } },
      }),
    },
    {
      displayName: 'Belongs to a website assigned to the admin (via page)',
      name: 'section-belongs-to-assigned-website',
      category: 'Website scope',
      plugin: 'admin',
      handler: (user: { id: number }) => ({
        page: { website: { admins: { id: { $in: [user.id] } } } },
      }),
    },
  ]);
};

export default {
  register() {},

  async bootstrap() {
    await registerWebsiteScopeConditions();

    if (process.env.SEED_STRUCTURE === 'true') {
      const seedStructure = (await import('./seed')).default;
      await seedStructure();
    }
  },
};
