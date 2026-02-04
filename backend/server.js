
/**
 * Simple Express + Mongoose API for Daily Report Automator
 * Stores users, reports, settings, colors, and editor metadata in MongoDB.
 */
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;
const MAX_REPORTS = 30;

// Prefer env, fall back to the provided connection string.
const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://zea3dhyperx_db_user:FjGNrsIDvZAP8CrY@cluster0.kei6ain.mongodb.net/daily_reports_db?retryWrites=true&w=majority&appName=Cluster0';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

app.use(cors());
app.use(express.json());

// Schemas
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    employeeId: { type: String, required: true },
    teamName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    defaultTo: { type: String, default: '' },
    defaultCc: { type: String, default: '' },
    savedColors: { type: [String], default: [] },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' }
  },
  { timestamps: true }
);

const TaskSchema = new mongoose.Schema(
  {
    id: String,
    projectName: String,
    projectType: String,
    assignedBy: String,
    employeeName: String,
    employeeId: String,
    teamName: String,
    startTime: String,
    endTime: String,
    workingHours: String,
    remarks: String,
    isRunning: Boolean,
    date: String,
    day: String
  },
  { _id: false }
);

const PlanningTaskSchema = new mongoose.Schema(
  {
    id: String,
    label: String,
    description: String
  },
  { _id: false }
);

const ReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    day: { type: String, required: true },
    tasks: { type: [TaskSchema], default: [] },
    planningTasks: { type: [PlanningTaskSchema], default: [] },
    preText: { type: String, default: '' },
    postText: { type: String, default: '' },
    themeColor: { type: String, default: '#70ad47' },
    isPlainTheme: { type: Boolean, default: false },
    createdAt: { type: Number, default: () => Date.now() }
  },
  { timestamps: true }
);

const User = mongoose.model('User', UserSchema);
const Report = mongoose.model('Report', ReportSchema);

// Helpers to normalize IDs for the frontend
const toUser = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  employeeId: doc.employeeId,
  teamName: doc.teamName,
  email: doc.email,
  defaultTo: doc.defaultTo,
  defaultCc: doc.defaultCc,
  savedColors: doc.savedColors,
  theme: doc.theme
});

const toReport = (doc) => ({
  id: doc._id.toString(),
  userId: doc.userId.toString(),
  date: doc.date,
  day: doc.day,
  tasks: doc.tasks || [],
  planningTasks: doc.planningTasks || [],
  createdAt: doc.createdAt,
  preText: doc.preText,
  postText: doc.postText,
  themeColor: doc.themeColor,
  isPlainTheme: doc.isPlainTheme
});

// Auth Endpoints
app.post('/api/auth/signup', async (req, res) => {
  try {
    const existing = await User.findOne({ email: req.body.email });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const user = await User.create(req.body);
    res.json(toUser(user));
  } catch (err) {
    console.error('Signup error', err);
    res.status(400).json({ error: 'Invalid data' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(toUser(user));
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/auth/user/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.id;
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(toUser(user));
  } catch (err) {
    console.error('Update user error', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// Report Endpoints
app.get('/api/reports/:userId', async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(reports.map(toReport));
  } catch (err) {
    console.error('Fetch reports error', err);
    res.status(500).json({ error: 'Fetch failed' });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const { id, ...data } = req.body;

    if (!data.userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Enforce per-user limit on new reports only
    if (!id) {
      const count = await Report.countDocuments({ userId: data.userId });
      if (count >= MAX_REPORTS) {
        return res
          .status(400)
          .json({ error: `Storage Limit Reached. Max ${MAX_REPORTS} reports allowed.` });
      }
    }

    if (id && mongoose.Types.ObjectId.isValid(id)) {
      const report = await Report.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true }
      );
      if (!report) return res.status(404).json({ error: 'Report not found' });
      return res.json(toReport(report));
    }

    const report = await Report.create(data);
    return res.json(toReport(report));
  } catch (err) {
    console.error('Save report error', err);
    res.status(500).json({ error: 'Save failed' });
  }
});

app.delete('/api/reports/:id', async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete report error', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
