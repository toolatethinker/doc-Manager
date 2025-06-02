import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../../users/entities/user.entity';

export async function createAdminUser(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  
  // Check if admin user already exists
  const existingAdmin = await userRepository.findOne({
    where: { email: 'raghav@example.com' }
  });

  if (existingAdmin) {
    console.log('Admin user already exists');
    return existingAdmin;
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash('raghav123', 10);
  
  const adminUser = userRepository.create({
    email: 'raghav@example.com',
    firstName: 'Raghav',
    lastName: 'Sharma',
    password: hashedPassword,
    role: UserRole.ADMIN,
    isActive: true,
  });

  const savedUser = await userRepository.save(adminUser);
  console.log('Admin user created successfully:', savedUser.email);
  
  return savedUser;
} 