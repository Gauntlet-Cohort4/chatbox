-- Seed data for local development.
-- Run after schema.sql. Idempotent via INSERT OR IGNORE.

-- Sample teachers
INSERT OR IGNORE INTO teachers (teacherId, teacherName, joinCode, apiToken, createdAt) VALUES
  ('teacher_alice', 'Ms. Alice Rivera', 'ALPHA1', 'seed-token-alice-0000000000000000000000000000000000000000000000', 1696000000000),
  ('teacher_bob', 'Mr. Bob Chen', 'BETA22', 'seed-token-bob-00000000000000000000000000000000000000000000000000', 1696000100000);

-- Sample approved plugins across categories
INSERT OR IGNORE INTO plugins (
  pluginId, pluginName, description, version, author, authorEmail,
  category, contentRating, toolDefinitions, userInterfaceConfig,
  authenticationConfig, contextPrompt, capabilities,
  bundleUrl, bundleVersion, bundleHash, bundleSizeBytes, screenshotKey,
  submissionStatus, submittedAt, reviewedAt, reviewedBy,
  averageRating, totalRatings, totalReports
) VALUES
  ('chess', 'Chess Tutor', 'Interactive chess board for teaching openings and tactics.',
   '1.0.0', 'ChatBridge Team', 'team@chatbridge.ai',
   'Math', 'educational', '[]', '{"defaultWidth":600,"defaultHeight":700,"sandboxPermissions":["allow-scripts"],"isPersistent":true}',
   '{"authType":"none"}', 'Guide the student through chess concepts.',
   '{"supportsScreenshot":true,"supportsVerboseState":true,"supportsEventLog":true}',
   'bundles/chess/1.0.0/bundle.zip', '1.0.0', 'deadbeef0000000000000000000000000000000000000000000000000000beef', 130000,
   'screenshots/chess/screenshot.png', 'approved', 1696100000000, 1696110000000, 'admin',
   4.7, 12, 0),

  ('fraction-tiles', 'Fraction Tiles', 'Drag-and-drop fraction tiles for visualizing equivalent fractions.',
   '0.9.0', 'Jane Doe', null,
   'Math', 'educational', '[]', '{"defaultWidth":500,"defaultHeight":500,"sandboxPermissions":["allow-scripts"],"isPersistent":false}',
   '{"authType":"none"}', 'Help the student understand fraction equivalence.',
   '{"supportsScreenshot":true,"supportsVerboseState":false,"supportsEventLog":false}',
   'bundles/fraction-tiles/0.9.0/bundle.zip', '0.9.0', 'aaaa000000000000000000000000000000000000000000000000000000000001', 58000,
   'screenshots/fraction-tiles/screenshot.png', 'approved', 1696200000000, 1696210000000, 'admin',
   4.2, 5, 0),

  ('weather-explorer', 'Weather Explorer', 'Explore real-time weather data and patterns across the globe.',
   '1.1.0', 'Skylab Studios', 'hi@skylab.example',
   'Science', 'general', '[]', '{"defaultWidth":800,"defaultHeight":600,"sandboxPermissions":["allow-scripts"],"isPersistent":false}',
   '{"authType":"api-key","keyHeaderName":"X-API-Key","instructions":"Get a key from weatherapi.example"}',
   'Explain weather phenomena the student sees on screen.',
   '{"supportsScreenshot":true,"supportsVerboseState":true,"supportsEventLog":false}',
   'bundles/weather-explorer/1.1.0/bundle.zip', '1.1.0', 'bbbb000000000000000000000000000000000000000000000000000000000002', 220000,
   'screenshots/weather-explorer/screenshot.png', 'approved', 1696300000000, 1696310000000, 'admin',
   4.5, 18, 0),

  ('word-weaver', 'Word Weaver', 'A vocabulary game that builds grade-level word mastery.',
   '2.0.0', 'Lexi Labs', null,
   'English/Language Arts', 'safe', '[]', '{"defaultWidth":600,"defaultHeight":500,"sandboxPermissions":["allow-scripts"],"isPersistent":false}',
   '{"authType":"none"}', 'Encourage the student and celebrate progress.',
   '{"supportsScreenshot":false,"supportsVerboseState":true,"supportsEventLog":true}',
   'bundles/word-weaver/2.0.0/bundle.zip', '2.0.0', 'cccc000000000000000000000000000000000000000000000000000000000003', 95000,
   'screenshots/word-weaver/screenshot.png', 'approved', 1696400000000, 1696410000000, 'admin',
   4.8, 24, 0),

  ('timeline-tracker', 'Timeline Tracker', 'Visual historical timelines from antiquity to modern day.',
   '1.0.3', 'History Hub', 'contact@historyhub.example',
   'History/Social Studies', 'educational', '[]', '{"defaultWidth":900,"defaultHeight":500,"sandboxPermissions":["allow-scripts"],"isPersistent":false}',
   '{"authType":"none"}', 'Contextualize events the student selects.',
   '{"supportsScreenshot":true,"supportsVerboseState":false,"supportsEventLog":false}',
   'bundles/timeline-tracker/1.0.3/bundle.zip', '1.0.3', 'dddd000000000000000000000000000000000000000000000000000000000004', 140000,
   'screenshots/timeline-tracker/screenshot.png', 'approved', 1696500000000, 1696510000000, 'admin',
   4.3, 9, 0),

  ('color-mixer', 'Color Mixer', 'Teach color theory with an interactive RGB/CMYK mixer.',
   '0.5.0', 'Palette Pals', null,
   'Art', 'safe', '[]', '{"defaultWidth":500,"defaultHeight":500,"sandboxPermissions":["allow-scripts"],"isPersistent":false}',
   '{"authType":"none"}', 'Guide the student through color theory concepts.',
   '{"supportsScreenshot":true,"supportsVerboseState":false,"supportsEventLog":false}',
   'bundles/color-mixer/0.5.0/bundle.zip', '0.5.0', 'eeee000000000000000000000000000000000000000000000000000000000005', 40000,
   'screenshots/color-mixer/screenshot.png', 'approved', 1696600000000, 1696610000000, 'admin',
   3.9, 4, 0),

  ('rhythm-trainer', 'Rhythm Trainer', 'Clap-along rhythm practice tool with visual metronome.',
   '1.0.0', 'Metro Beats', null,
   'Music', 'safe', '[]', '{"defaultWidth":600,"defaultHeight":400,"sandboxPermissions":["allow-scripts"],"isPersistent":false}',
   '{"authType":"none"}', 'Encourage the student to keep a steady beat.',
   '{"supportsScreenshot":false,"supportsVerboseState":true,"supportsEventLog":true}',
   'bundles/rhythm-trainer/1.0.0/bundle.zip', '1.0.0', 'ffff000000000000000000000000000000000000000000000000000000000006', 75000,
   'screenshots/rhythm-trainer/screenshot.png', 'approved', 1696700000000, 1696710000000, 'admin',
   4.6, 7, 0),

  ('code-sandbox', 'Code Sandbox', 'Run tiny JavaScript snippets safely for intro CS lessons.',
   '0.3.0', 'Byte Academy', 'info@byteacademy.example',
   'Computer Science', 'educational', '[]', '{"defaultWidth":800,"defaultHeight":600,"sandboxPermissions":["allow-scripts"],"isPersistent":false}',
   '{"authType":"none"}', 'Explain what the student''s code does step by step.',
   '{"supportsScreenshot":true,"supportsVerboseState":true,"supportsEventLog":true}',
   'bundles/code-sandbox/0.3.0/bundle.zip', '0.3.0', '1111000000000000000000000000000000000000000000000000000000000007', 180000,
   'screenshots/code-sandbox/screenshot.png', 'approved', 1696800000000, 1696810000000, 'admin',
   4.1, 11, 0);

-- One pending plugin to exercise the admin approval flow
INSERT OR IGNORE INTO plugins (
  pluginId, pluginName, description, version, author, authorEmail,
  category, contentRating, toolDefinitions, userInterfaceConfig,
  authenticationConfig, contextPrompt, capabilities,
  bundleUrl, bundleVersion, bundleHash, bundleSizeBytes, screenshotKey,
  submissionStatus, submittedAt,
  averageRating, totalRatings, totalReports
) VALUES
  ('pending-puzzle', 'Pending Puzzle', 'A sliding puzzle game awaiting admin review.',
   '0.1.0', 'New Dev', 'newdev@example.com',
   'Misc', 'general', '[]', '{"defaultWidth":500,"defaultHeight":500,"sandboxPermissions":["allow-scripts"],"isPersistent":false}',
   '{"authType":"none"}', null,
   '{"supportsScreenshot":false,"supportsVerboseState":false,"supportsEventLog":false}',
   'bundles/pending-puzzle/0.1.0/bundle.zip', '0.1.0', '2222000000000000000000000000000000000000000000000000000000000008', 30000,
   null, 'pending', 1696900000000,
   0, 0, 0);

-- Sample reviews
INSERT OR IGNORE INTO reviews (reviewId, pluginId, teacherId, rating, reviewText, createdAt) VALUES
  ('review_1', 'chess', 'teacher_alice', 5, 'Students love it. Great for tactics practice.', 1697000000000),
  ('review_2', 'chess', 'teacher_bob', 4, 'Solid tool, but wish it had more puzzles.', 1697010000000),
  ('review_3', 'word-weaver', 'teacher_alice', 5, 'Our vocabulary scores jumped noticeably.', 1697020000000);

-- One open report
INSERT OR IGNORE INTO reports (reportId, pluginId, reporterId, reportReason, reportDetails, reportStatus, createdAt) VALUES
  ('report_1', 'color-mixer', 'teacher_bob', 'Broken/non-functional', 'The CMYK tab fails to load for my students.', 'open', 1697100000000);
