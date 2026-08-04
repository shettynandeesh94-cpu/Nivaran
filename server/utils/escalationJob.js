const cron = require('node-cron');
const Complaint = require('../models/Complaint');

function startEscalationJob() {
    // Runs every hour, at minute 0
    cron.schedule('0 * * * *', async () => {
        console.log('Running SLA escalation check...');
        try {
            const now = new Date();
            const overdue = await Complaint.find({
                status: { $in: ['OPEN', 'IN_PROGRESS'] },
                deadline: { $lt: now },
            });

            for (const complaint of overdue) {
                complaint.status = 'ESCALATED';
                await complaint.save();
                console.log(`Escalated complaint: ${complaint.title} (ward: ${complaint.ward})`);
            }

            console.log(`Escalation check complete. ${overdue.length} complaint(s) escalated.`);
        } catch (err) {
            console.error('Escalation job error:', err.message);
        }
    });
}

module.exports = startEscalationJob;