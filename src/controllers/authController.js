import pool from '../config/db.js';

const DEFAULT_SETTINGS = {
  city: '',
  zone: '',
  platform: 'Not set',
  activePlan: '—',
  autoRenewal: 'Enabled',
  upiId: '',
  backupBank: '',
  payoutFreq: 'Not set',
  weatherAlerts: 'SMS Only',
  claimAlerts: 'SMS Only',
  weeklySummary: 'Email Only',
};

const mapSettingsRow = (row) => {
  if (!row) return { ...DEFAULT_SETTINGS };

  return {
    city: row.city || '',
    zone: row.zone || '',
    platform: row.connected_platform || 'Not set',
    activePlan: row.active_plan || '—',
    autoRenewal: row.auto_renewal || 'Enabled',
    upiId: row.primary_upi_id || '',
    backupBank: row.backup_bank_account || '',
    payoutFreq: row.payout_frequency || 'Not set',
    weatherAlerts: row.weather_warnings || 'SMS Only',
    claimAlerts: row.claim_updates || 'SMS Only',
    weeklySummary: row.weekly_summary || 'Email Only',
  };
};

const upsertSettings = async (client, userId, payload = {}) => {
  await client.query(
    `INSERT INTO user_settings (
       user_id, city, zone, connected_platform, active_plan, auto_renewal,
       primary_upi_id, backup_bank_account, payout_frequency, weather_warnings,
       claim_updates, weekly_summary, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       city = EXCLUDED.city,
       zone = EXCLUDED.zone,
       connected_platform = EXCLUDED.connected_platform,
       active_plan = EXCLUDED.active_plan,
       auto_renewal = EXCLUDED.auto_renewal,
       primary_upi_id = EXCLUDED.primary_upi_id,
       backup_bank_account = EXCLUDED.backup_bank_account,
       payout_frequency = EXCLUDED.payout_frequency,
       weather_warnings = EXCLUDED.weather_warnings,
       claim_updates = EXCLUDED.claim_updates,
       weekly_summary = EXCLUDED.weekly_summary,
       updated_at = NOW()`,
    [
      userId,
      payload.city ?? '',
      payload.zone ?? '',
      payload.platform ?? 'Not set',
      payload.activePlan ?? '—',
      payload.autoRenewal ?? 'Enabled',
      payload.upiId ?? '',
      payload.backupBank ?? '',
      payload.payoutFreq ?? 'Not set',
      payload.weatherAlerts ?? 'SMS Only',
      payload.claimAlerts ?? 'SMS Only',
      payload.weeklySummary ?? 'Email Only',
    ]
  );
};

export const register = async (req, res) => {
  try {
    const { name, phone, city, zone, platform, type, hours, income } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required' });
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'User already exists, please log in' });
    }

    // Generate a placeholder email since the schema requires UNIQUE email
    const mockEmail = `${phone.replace(/\D/g, '')}@shieldpay.app`;

    const result = await pool.query(
      `INSERT INTO users (name, phone, email) VALUES ($1, $2, $3)
       RETURNING id, name, phone, email, created_at`,
      [name, phone, mockEmail]
    );

    const user = result.rows[0];
    await upsertSettings(pool, user.id, {
      city: city || '',
      zone: zone || '',
      platform: platform || 'Not set',
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        city: city || '',
        zone: zone || '',
        platform: platform || 'Not set',
        type: type || '',
        hours: hours || '40',
        income: income || '4500',
        email: user.email,
        joinedAt: user.created_at,
      }
    });

  } catch (error) {
    console.error('Registration Error:', error.message);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
};

export const login = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const { rows } = await pool.query(
      `SELECT
         u.id, u.name, u.phone, u.email, u.created_at,
         s.city, s.zone, s.connected_platform, s.active_plan, s.auto_renewal,
         s.primary_upi_id, s.backup_bank_account, s.payout_frequency,
         s.weather_warnings, s.claim_updates, s.weekly_summary
       FROM users u
       LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE u.phone = $1`,
      [phone]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found, please sign up' });
    }

    const user = rows[0];
    const settings = mapSettingsRow(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        ...settings,
        joinedAt: user.created_at,
      }
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
};

export const getSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const { rows } = await pool.query(
      `SELECT
         u.id, u.name, u.phone, u.email,
         s.city, s.zone, s.connected_platform, s.active_plan, s.auto_renewal,
         s.primary_upi_id, s.backup_bank_account, s.payout_frequency,
         s.weather_warnings, s.claim_updates, s.weekly_summary
       FROM users u
       LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const row = rows[0];
    res.status(200).json({
      success: true,
      user: {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        ...mapSettingsRow(row),
      },
    });
  } catch (error) {
    console.error('Get Settings Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch settings.' });
  }
};

export const updateSettings = async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const {
      name = '',
      phone = '',
      email = '',
      city = '',
      zone = '',
      platform = 'Not set',
      activePlan = '—',
      autoRenewal = 'Enabled',
      upiId = '',
      backupBank = '',
      payoutFreq = 'Not set',
      weatherAlerts = 'SMS Only',
      claimAlerts = 'SMS Only',
      weeklySummary = 'Email Only',
    } = req.body || {};

    await client.query('BEGIN');

    const userResult = await client.query(
      `UPDATE users
       SET name = $1,
           phone = $2,
           email = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, phone, email`,
      [name || 'Unknown User', phone || null, email || `${String(phone || userId).replace(/\D/g, '')}@shieldpay.app`, userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await upsertSettings(client, userId, {
      city,
      zone,
      platform,
      activePlan,
      autoRenewal,
      upiId,
      backupBank,
      payoutFreq,
      weatherAlerts,
      claimAlerts,
      weeklySummary,
    });

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      user: {
        ...userResult.rows[0],
        city,
        zone,
        platform,
        activePlan,
        autoRenewal,
        upiId,
        backupBank,
        payoutFreq,
        weatherAlerts,
        claimAlerts,
        weeklySummary,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update Settings Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update settings.' });
  } finally {
    client.release();
  }
};
