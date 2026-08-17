CREATE INDEX IF NOT EXISTS consultation_messages_thread_idx
  ON consultation_messages (consultation_id, id)
