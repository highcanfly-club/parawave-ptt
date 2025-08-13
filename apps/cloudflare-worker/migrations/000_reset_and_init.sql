-- Reset Parawave-PTT Database to Initial State
-- This script drops all tables and re-applies the initial schema and seed data

PRAGMA foreign_keys = OFF;

-- Drop all tables if they exist
DROP TABLE IF EXISTS site_channels;
DROP TABLE IF EXISTS flying_sites;
DROP TABLE IF EXISTS transmission_history;
DROP TABLE IF EXISTS channel_messages;
DROP TABLE IF EXISTS channel_participants;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS user_preferences;

PRAGMA foreign_keys = ON;

