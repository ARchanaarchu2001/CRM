import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';



const usersToSeed = [
  {
    fullName: 'Super Admin User',
    email: 'superadmin@example.com',
    password: 'password123', // Will be hashed by pre-save middleware
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isBlocked: false,
  },
  {
    fullName: 'Data Analyst User',
    email: 'analyst@example.com',
    password: 'password123',
    role: ROLES.DATA_ANALYST,
    isActive: true,
    isBlocked: false,
  },
  {
    fullName: 'Team Lead User',
    email: 'teamlead@example.com',
    password: 'password123',
    role: ROLES.TEAM_LEAD,
    isActive: true,
    isBlocked: false,
  },
  {
    fullName: 'Manager User',
    email: 'manager@example.com',
    password: 'password123',
    role: ROLES.MANAGER,
    isActive: true,
    isBlocked: false,
  },
  {
    fullName: 'Agent User',
    email: 'agent@example.com',
    password: 'password123',
    role: ROLES.AGENT,
    isActive: true,
    isBlocked: false,
  },
];

const seedUsers = async () => {
  try {
    // Connect to database securely
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    for (const userData of usersToSeed) {
      // Check if user already exists to make script safe to run multiple times
      const existingUser = await User.findOne({ email: userData.email });
      
      if (!existingUser) {
        await User.create(userData);
        console.log(`Seeded new user: ${userData.email} (${userData.role})`);
      } else {
        console.log(`User already exists: ${userData.email}`);
      }
    }

    console.log('Seeding procedure completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error(`Error during seeding: ${error.message}`);
    process.exit(1);
  }
};

seedUsers();
