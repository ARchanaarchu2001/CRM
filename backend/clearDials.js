import 'dotenv/config';
import mongoose from 'mongoose';
import LeadAssignment from './models/LeadAssignment.js';



const clearDials = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    const result = await LeadAssignment.updateMany(
      {},
      { $set: { workedDates: [] } }
    );
    
    console.log(`Cleared workedDates for ${result.modifiedCount} leads.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

clearDials();
