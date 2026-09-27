import "dotenv/config";

// Integration tests always run against the dedicated test database.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.STORAGE_DIR = process.env.TEST_STORAGE_DIR ?? "./storage-test";
