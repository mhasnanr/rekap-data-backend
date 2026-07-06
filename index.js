const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
const corsOptions = require('./config/cors');
require('dotenv').config();

const app = express();

app.use(morgan(':method :url :status - :response-time ms'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors(corsOptions));

let isConnected = false;

async function connectToDatabase() {
  if (isConnected) return;
  await mongoose.connect(process.env.SITUNTING_DATABASE_URL);
  isConnected = true;
  console.log('Mongoose connected to db');
}

app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

app.get('/', (req, res) => {
  res.send('Welcome to Situnting Backend!');
});

app.use('/parents', require('./routes/parent.route.js'));
app.use('/children', require('./routes/child.route.js'));
app.use('/records', require('./routes/record.route.js'));
app.use('/reports', require('./routes/report.route.js'));
app.use('/summary', require('./routes/summary.route.js'));
app.use('/immunisation', require('./routes/immunisation.route.js'));

module.exports = app;
