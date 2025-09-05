-- Migration to support multiple device connections per user
-- This allows the same user to connect from multiple devices (iOS app + web client)

-- First, create a new table with the updated structure
CREATE TABLE IF NOT EXISTS channel_participants_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_uuid TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    join_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    location_lat REAL,
    location_lon REAL,
    connection_quality TEXT DEFAULT 'good' CHECK (connection_quality IN ('poor', 'fair', 'good', 'excellent')),
    is_transmitting BOOLEAN DEFAULT FALSE,
    ephemeral_push_token TEXT NOT NULL, -- Now required for unique device identification
    device_os TEXT, -- Operating system (iOS, Android, Web, etc.)
    device_os_version TEXT, -- OS version (e.g., "17.5.1", "14", "Chrome 119.0")
    app_version TEXT, -- Application version (e.g., "1.2.3", "2.0.0-beta.1")
    user_agent TEXT, -- Full user agent string for debugging
    FOREIGN KEY (channel_uuid) REFERENCES channels (uuid) ON DELETE CASCADE,
    UNIQUE(channel_uuid, user_id, ephemeral_push_token) -- Allow multiple devices per user
);

-- Migrate existing data
INSERT INTO channel_participants_new (
    channel_uuid, user_id, username, join_time, last_seen,
    location_lat, location_lon, connection_quality, is_transmitting,
    ephemeral_push_token, device_os, device_os_version, app_version, user_agent
)
SELECT
    channel_uuid, user_id, username, join_time, last_seen,
    location_lat, location_lon, connection_quality, is_transmitting,
    COALESCE(ephemeral_push_token, 'legacy-' || user_id || '-' || id), -- Generate token for legacy entries
    device_os, device_os_version, app_version, user_agent
FROM channel_participants;

-- Drop old table and rename new one
DROP TABLE channel_participants;
ALTER TABLE channel_participants_new RENAME TO channel_participants;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_channel_participants_channel_uuid ON channel_participants(channel_uuid);
CREATE INDEX IF NOT EXISTS idx_channel_participants_user_id ON channel_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_participants_ephemeral_token ON channel_participants(ephemeral_push_token);
