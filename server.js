
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// MongoDB Connection String
const MONGO_URI = 'mongodb+srv://zea3dhyperx_db_user:FjGNrsIDvZAP8CrY@cluster0.kei6ain.mongodb.net/daily_reports_db?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const UserSchema = new mongoose.Schema({
  name: String,
  employeeId: String,
  teamName: String,
  email: { type: String, unique: true },
  webhookUrl: String
});

const ReportSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  date: String,
  day: String,
  tasks: Array,
  createdAt: { type: Number, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Report = mongoose.model('Report', ReportSchema);

app.use(cors());
app.use(express.json());

// Auth Endpoints
app.post('/api/auth/signup', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: 'User already exists or invalid data' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/auth/user', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.body.id, req.body, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Report Endpoints
app.get('/api/reports/:userId', async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const { id, ...data } = req.body;
    let report;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      report = await Report.findByIdAndUpdate(id, data, { new: true, upsert: true });
    } else {
      report = new Report(data);
      await report.save();
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Save failed' });
  }
});

app.delete('/api/reports/:id', async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
