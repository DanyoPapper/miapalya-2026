const router = require('express').Router();
const db     = require('../config/database');
const { profileLimiter } = require('../middleware/rateLimit');

router.post('/save', profileLimiter, async (req, res) => {
  try {
    const { sessionToken, quizAnswers, profileId } = req.body;
    if (!sessionToken) return res.status(400).json({ error: 'MISSING_SESSION' });
    // Méret-korlát: a quizAnswers max 50 elem, profileId max 50 karakter
    const safeAnswers = Array.isArray(quizAnswers) ? quizAnswers.slice(0, 50) : [];
    const safeProfileId = profileId ? String(profileId).slice(0, 50) : null;
    await db.query(
      'UPDATE sessions SET quiz_answers=$1,profile_id=$2 WHERE token=$3',
      [JSON.stringify(safeAnswers), safeProfileId, sessionToken]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.get('/:sessionToken', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.token,s.name,s.quiz_answers,s.profile_id,s.created_at,
              COALESCE(json_agg(st.zone_id) FILTER (WHERE st.zone_id IS NOT NULL),'[]') AS collected_stamps
       FROM sessions s LEFT JOIN stamps st ON s.id=st.session_id
       WHERE s.token=$1 GROUP BY s.id`,
      [req.params.sessionToken]
    );
    if (!rows.length) return res.status(404).json({ error:'NOT_FOUND' });
    const r = rows[0];
    res.json({
      sessionToken: r.token, name: r.name,
      quizAnswers: r.quiz_answers, profileId: r.profile_id,
      collectedStamps: r.collected_stamps, quizCompleted: !!r.profile_id,
    });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

module.exports = router;
