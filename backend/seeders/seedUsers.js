import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Lead from '../models/Lead.js';
import LeadImport from '../models/LeadImport.js';
import LeadAssignment from '../models/LeadAssignment.js';
import { ROLES } from '../constants/roles.js';

// Load env variables
dotenv.config();

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
  // Agents
  {
    fullName: 'John Smith',
    email: 'john.smith@agent.com',
    password: 'password123',
    role: ROLES.AGENT,
    isActive: true,
    isBlocked: false,
  },
  {
    fullName: 'Sarah Johnson',
    email: 'sarah.johnson@agent.com',
    password: 'password123',
    role: ROLES.AGENT,
    isActive: true,
    isBlocked: false,
  },
  {
    fullName: 'Michael Brown',
    email: 'michael.brown@agent.com',
    password: 'password123',
    role: ROLES.AGENT,
    isActive: true,
    isBlocked: false,
  },
  {
    fullName: 'Emily Davis',
    email: 'emily.davis@agent.com',
    password: 'password123',
    role: ROLES.AGENT,
    isActive: true,
    isBlocked: false,
  },
  {
    fullName: 'David Wilson',
    email: 'david.wilson@agent.com',
    password: 'password123',
    role: ROLES.AGENT,
    isActive: true,
    isBlocked: false,
  },
];

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // Seed users
    const createdUsers = {};
    for (const userData of usersToSeed) {
      const existingUser = await User.findOne({ email: userData.email });
      
      if (!existingUser) {
        const createdUser = await User.create(userData);
        createdUsers[userData.email] = createdUser;
        console.log(`Seeded new user: ${userData.email} (${userData.role})`);
      } else {
        createdUsers[userData.email] = existingUser;
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

seedData();
