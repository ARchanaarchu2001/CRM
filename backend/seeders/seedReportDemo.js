import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Lead from '../models/Lead.js';
import LeadImport from '../models/LeadImport.js';
import LeadAssignment from '../models/LeadAssignment.js';
import { ROLES } from '../constants/roles.js';



const MONGO_URI = process.env.MONGO_URI;

const PRODUCTS = ['loan', 'credit_card', 'insurance', 'wealth'];
const STATUSES = ['', 'submitted', 'activated', 'follow_up', 'completed'];
const REMARKS = [
  'Customer interested in premium tier',
  'Busy, try calling in the afternoon',
  'Already has a similar product, not interested',
  'Documents pending from customer side',
  'Very positive lead, high conversion probability',
  'Wrong number provided',
  'Requested call back on Monday',
  'Language barrier issues',
  'Disconnected immediately',
  'Not eligible for current offer'
];

const COMPANIES = [
  'Global Tech Solutions', 'Bright Future Inc', 'Summit Dynamics', 'Oceanic Logistics',
  'Pinnacle Healthcare', 'Nexus Financial', 'Terraform Realty', 'Nova Energy',
  'Quantum Software', 'Empire Consulting', 'Blue Sky Retail', 'Heritage Motors'
];

const seedDemoData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding demo data...');

    // 1. Get Agents and Analyst
    const agents = await User.find({ role: ROLES.AGENT });
    const analyst = await User.findOne({ role: ROLES.DATA_ANALYST });

    if (!agents.length || !analyst) {
      console.error('Agents or Analyst not found. Please run seedUsers.js first.');
      process.exit(1);
    }

    // 2. Clear previous demo data
    const existingDemoBatch = await LeadImport.findOne({ batchName: 'Demo Intelligence Batch' });
    if (existingDemoBatch) {
      console.log('Cleaning up previous demo batch...');
      await LeadAssignment.deleteMany({ importBatch: existingDemoBatch._id });
      await Lead.deleteMany({ importBatch: existingDemoBatch._id });
      await existingDemoBatch.deleteOne();
    }

    // 3. Create Demo Batch
    const demoBatch = await LeadImport.create({
      product: 'general',
      batchName: 'Demo Intelligence Batch',
      sourceFileName: 'demo_data_2026.xlsx',
      uploadedBy: analyst._id,
      contactColumn: 'Mobile',
      headers: ['Name', 'Mobile', 'Company', 'Industry'],
      totalRows: 150
    });

    console.log('Created Demo Batch:', demoBatch._id);

    // 4. Create Leads
    const leads = [];
    for (let i = 0; i < 150; i++) {
      const company = COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
      leads.push({
        importBatch: demoBatch._id,
        batchName: demoBatch.batchName,
        product: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
        uploadedBy: analyst._id,
        rowIndex: i + 1,
        contactNumber: `98765${String(i).padStart(5, '0')}`,
        contactColumn: 'Mobile',
        rawData: {
          'Name': `Customer ${i + 1}`,
          'Mobile': `98765${String(i).padStart(5, '0')}`,
          'Company': company,
          'Industry': 'Technology'
        }
      });
    }
    const createdLeads = await Lead.insertMany(leads);
    console.log(`Successfully created ${createdLeads.length} demo leads.`);

    // 5. Create Assignments & Interactions
    const assignments = [];
    const now = new Date();
    
    // Last 90 days distribution
    for (let i = 0; i < 800; i++) {
        const lead = createdLeads[i % createdLeads.length];
        const agent = agents[i % agents.length];
        const product = lead.product;
        
        // Random date in last 90 days
        const createdAt = new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000);
        const status = Math.random() > 0.7 ? STATUSES[Math.floor(Math.random() * STATUSES.length)] : '';
        
        const isSubmitted = status === 'submitted' || status === 'activated' || Math.random() > 0.8;
        const isActivated = status === 'activated' || (isSubmitted && Math.random() > 0.7);
        
        const interactionDate = new Date(createdAt.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000);

        assignments.push({
            lead: lead._id,
            importBatch: demoBatch._id,
            batchName: demoBatch.batchName,
            product: product,
            agent: agent._id,
            assignedBy: analyst._id,
            assignedAgentName: agent.fullName,
            status: isActivated ? 'activated' : (isSubmitted ? 'submitted' : status),
            submittedAt: isSubmitted ? interactionDate : null,
            activatedAt: isActivated ? new Date(interactionDate.getTime() + 24 * 60 * 60 * 1000) : null,
            callingRemark: Math.random() > 0.3 ? (isSubmitted ? 'Interested' : 'Follow up') : 'Callback',
            contactabilityStatus: 'Connected',
            interestedRemark: isSubmitted ? 'Proceeded with documents' : '',
            agentNotes: REMARKS[Math.floor(Math.random() * REMARKS.length)],
            createdAt: createdAt,
            updatedAt: interactionDate,
            workedDates: [createdAt.toISOString().slice(0, 10)]
        });
    }

    await LeadAssignment.insertMany(assignments);
    console.log(`Successfully seeded ${assignments.length} historical interactions!`);

    console.log('Demo seeding complete. Dashboard should now be fully populated.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding demo data:', error);
    process.exit(1);
  }
};

seedDemoData();
