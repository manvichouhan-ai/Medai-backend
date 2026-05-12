import mongoose from 'mongoose';

export default async function globalSetup() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medai_test');
}

export async function globalTeardown() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
