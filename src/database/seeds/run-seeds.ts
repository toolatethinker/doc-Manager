import { AppDataSource } from '../data-source';
import { createAdminUser } from './admin-user';

async function runSeeds() {
  try {
    // Initialize the data source
    await AppDataSource.initialize();
    console.log('Database connection established');

    // Run seeds
    await createAdminUser(AppDataSource);

    console.log('Seeds completed successfully');
  } catch (error) {
    console.error('Error running seeds:', error);
  } finally {
    // Close the connection
    await AppDataSource.destroy();
  }
}

runSeeds(); 