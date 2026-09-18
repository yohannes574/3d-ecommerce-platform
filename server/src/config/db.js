const mongoose = require('mongoose');

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/voltix';

async function connectDB() {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  mongoose.set('strictQuery', true);

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log(`✅ MongoDB connected → ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error('\n❌ Failed to connect to MongoDB.');
    console.error(`   URI attempted: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
    console.error(`   Reason: ${err.message}\n`);
    console.error('   Fixes:');
    console.error('   • Make sure MongoDB is running locally (service "MongoDB" or `mongod`).');
    console.error('   • Or set MONGODB_URI in server/.env to a MongoDB Atlas connection string.\n');
    process.exit(1);
  }
}

module.exports = connectDB;
