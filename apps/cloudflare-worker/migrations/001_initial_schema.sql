-- PTT Parapente Database Schema
-- SQLite schema for D1 database

-- Channels table - Core PTT channels configuration
CREATE TABLE IF NOT EXISTS channels (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('site_local', 'emergency', 'general', 'cross_country', 'instructors')),
    description TEXT,
    coordinates_lat REAL,
    coordinates_lon REAL,
    radius_km REAL DEFAULT 50,
    vhf_frequency TEXT,
    max_participants INTEGER DEFAULT 50,
    difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    updated_at DATETIME,
    updated_by TEXT
);

-- Channel participants - Real-time participant tracking
CREATE TABLE IF NOT EXISTS channel_participants (
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
    ephemeral_push_token TEXT NOT NULL, -- Ephemeral APNs PTT token from iOS framework (required for multi-device support)
    device_os TEXT, -- Operating system (iOS, Android, Web, etc.)
    device_os_version TEXT, -- OS version (e.g., "17.5.1", "14", "Chrome 119.0")
    app_version TEXT, -- Application version (e.g., "1.2.3", "2.0.0-beta.1")
    user_agent TEXT, -- Full user agent string for debugging
    FOREIGN KEY (channel_uuid) REFERENCES channels (uuid) ON DELETE CASCADE,
    UNIQUE(channel_uuid, user_id, ephemeral_push_token) -- Allow multiple devices per user
);

-- Channel messages - Message and transmission history
CREATE TABLE IF NOT EXISTS channel_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_uuid TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('audio_start', 'audio_end', 'text', 'emergency', 'join', 'leave')),
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    location_lat REAL,
    location_lon REAL,
    metadata TEXT, -- JSON metadata for additional info
    FOREIGN KEY (channel_uuid) REFERENCES channels (uuid) ON DELETE CASCADE
);

-- Transmission history - Detailed PTT transmission logs
CREATE TABLE IF NOT EXISTS transmission_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    channel_uuid TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_seconds INTEGER,
    audio_format TEXT CHECK (audio_format IN ('aac-lc', 'opus', 'pcm')),
    chunks_count INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    participant_count INTEGER DEFAULT 0,
    is_emergency BOOLEAN DEFAULT FALSE,
    network_quality TEXT CHECK (network_quality IN ('excellent', 'good', 'fair', 'poor')),
    quality_score REAL CHECK (quality_score >= 0 AND quality_score <= 1),
    network_type TEXT, -- '2G', '3G', '4G', '5G', 'WiFi'
    signal_strength INTEGER, -- Signal strength in dBm
    location_lat REAL,
    location_lon REAL,
    FOREIGN KEY (channel_uuid) REFERENCES channels (uuid) ON DELETE CASCADE
);

-- Flying sites - Paragliding site definitions
CREATE TABLE IF NOT EXISTS flying_sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    coordinates_lat REAL NOT NULL,
    coordinates_lon REAL NOT NULL,
    elevation INTEGER NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
    vhf_frequency TEXT,
    radius_km REAL DEFAULT 25,
    weather_station_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Site-channel associations - Many-to-many relationship
CREATE TABLE IF NOT EXISTS site_channels (
    site_id TEXT NOT NULL,
    channel_uuid TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (site_id, channel_uuid),
    FOREIGN KEY (site_id) REFERENCES flying_sites (id) ON DELETE CASCADE,
    FOREIGN KEY (channel_uuid) REFERENCES channels (uuid) ON DELETE CASCADE
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    preferred_language TEXT DEFAULT 'fr-FR',
    favorite_sites TEXT, -- JSON array of site IDs
    auto_join_site_channels BOOLEAN DEFAULT TRUE,
    emergency_mode_enabled BOOLEAN DEFAULT TRUE,
    vhf_backup_frequency TEXT,
    device_token TEXT, -- APNs device token for iOS notifications
    last_location_lat REAL,
    last_location_lon REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_active ON channels(is_active);
CREATE INDEX IF NOT EXISTS idx_channels_coordinates ON channels(coordinates_lat, coordinates_lon);
CREATE INDEX IF NOT EXISTS idx_channel_participants_channel ON channel_participants(channel_uuid);
CREATE INDEX IF NOT EXISTS idx_channel_participants_user ON channel_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_participants_last_seen ON channel_participants(last_seen);
CREATE INDEX IF NOT EXISTS idx_channel_participants_push_token ON channel_participants(ephemeral_push_token);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_uuid);
CREATE INDEX IF NOT EXISTS idx_channel_messages_timestamp ON channel_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_channel_messages_type ON channel_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_transmission_history_channel ON transmission_history(channel_uuid);
CREATE INDEX IF NOT EXISTS idx_transmission_history_user ON transmission_history(user_id);
CREATE INDEX IF NOT EXISTS idx_transmission_history_start_time ON transmission_history(start_time);
CREATE INDEX IF NOT EXISTS idx_transmission_history_session_id ON transmission_history(session_id);
CREATE INDEX IF NOT EXISTS idx_transmission_history_channel_start_time ON transmission_history(channel_uuid, start_time);
CREATE INDEX IF NOT EXISTS idx_flying_sites_coordinates ON flying_sites(coordinates_lat, coordinates_lon);
CREATE INDEX IF NOT EXISTS idx_flying_sites_active ON flying_sites(is_active);

-- Insert default emergency channel
INSERT OR IGNORE INTO channels (
    uuid,
    name,
    type,
    description,
    max_participants,
    is_active,
    created_by
) VALUES (
    '8a9a3d41-1e5d-4159-8f82-0e073bc9dc33',
    'Urgence Alpes',
    'emergency',
    'Canal d''urgence pour les Alpes françaises - Contact PGHM automatique',
    200,
    TRUE,
    'system'
);

-- Insert sample flying sites
INSERT OR IGNORE INTO flying_sites (
    id,
    name,
    coordinates_lat,
    coordinates_lon,
    elevation,
    difficulty,
    vhf_frequency,
    radius_km
) VALUES 
    ('chamonix-planpraz', 'Chamonix - Plan Praz', 45.929681, 6.876345, 2000, 'intermediate', '144.150', 50),
    ('annecy-forclaz', 'Annecy - Col de la Forclaz', 45.773056, 6.196389, 1245, 'beginner', '143.9875', 35),
    ('saint-hilaire', 'Saint-Hilaire du Touvet', 45.324444, 5.884444, 1200, 'intermediate', '144.475', 40);

-- Insert sample channels for flying sites
INSERT OR IGNORE INTO channels (
    uuid,
    name,
    type,
    description,
    coordinates_lat,
    coordinates_lon,
    radius_km,
    vhf_frequency,
    max_participants,
    difficulty,
    created_by
) VALUES 
    ('04b242cb-91b5-4e6d-a10a-27099fb6e866', 'Chamonix Local', 'site_local', 'Canal principal site Chamonix Mont-Blanc', 45.929681, 6.876345, 50, '144.150', 100, 'intermediate', 'system'),
    ('74250fc5-4569-49b1-a5f3-b3abeec34ef2', 'Annecy Débutants', 'site_local', 'Canal débutants Annecy Forclaz', 45.773056, 6.196389, 35, '143.9875', 75, 'beginner', 'system'),
    ('0cca8e49-c261-4fbb-959f-ef0f846faa5d', 'Instructeurs Région', 'instructors', 'Canal réservé instructeurs certifiés', NULL, NULL, NULL, '144.500', 50, NULL, 'system');

-- Associate channels with sites
INSERT OR IGNORE INTO site_channels (site_id, channel_uuid, is_primary) VALUES 
    ('chamonix-planpraz', '04b242cb-91b5-4e6d-a10a-27099fb6e866', TRUE),
    ('annecy-forclaz', '74250fc5-4569-49b1-a5f3-b3abeec34ef2', TRUE);

-- Create view for push token statistics (admin use)
CREATE VIEW IF NOT EXISTS v_channel_push_token_stats AS
SELECT 
    channel_uuid,
    COUNT(*) as total_participants,
    COUNT(ephemeral_push_token) as participants_with_push_token,
    ROUND(
        (COUNT(ephemeral_push_token) * 100.0 / COUNT(*)), 2
    ) as push_token_coverage_percent
FROM channel_participants
GROUP BY channel_uuid;
