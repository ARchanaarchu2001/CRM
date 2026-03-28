import mongoose from 'mongoose';

const leadAssignmentSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    },
    importBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeadImport',
      required: true,
    },
    batchName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    product: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAgentName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['', 'submitted', 'activated', 'new', 'in_progress', 'follow_up', 'completed'],
      default: '',
    },
    contactabilityStatus: {
      type: String,
      default: '',
      trim: true,
    },
    callAttempt1Date: {
      type: String,
      default: '',
    },
    callAttempt2Date: {
      type: String,
      default: '',
    },
    callingRemark: {
      type: String,
      default: '',
      trim: true,
    },
    interestedRemark: {
      type: String,
      default: '',
      trim: true,
    },
    notInterestedRemark: {
      type: String,
      default: '',
      trim: true,
    },
    agentNotes: {
      type: String,
      default: '',
      trim: true,
    },
    hiddenByAgent: {
      type: Boolean,
      default: false,
      index: true,
    },
    inPipeline: {
      type: Boolean,
      default: false,
      index: true,
    },
    pipelineFollowUpDate: {
      type: String,
      default: '',
      trim: true,
    },
    pipelineNameColumn: {
      type: String,
      default: '',
      trim: true,
    },
    pipelineContactColumn: {
      type: String,
      default: '',
      trim: true,
    },
    pipelineDisplayName: {
      type: String,
      default: '',
      trim: true,
    },
    pipelineDisplayContact: {
      type: String,
      default: '',
      trim: true,
    },
    pipelineNotes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const LeadAssignment = mongoose.model('LeadAssignment', leadAssignmentSchema);

export default LeadAssignment;
