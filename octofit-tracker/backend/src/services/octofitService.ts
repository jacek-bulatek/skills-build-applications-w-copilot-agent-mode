import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(_input: unknown) {
  if (!_input || typeof _input !== 'object') {
    throw Object.assign(new Error('Activity request must be an object'), { status: 400 });
  }
  const input = _input as Record<string, unknown>;
  const { userId, teamId, type, minutes } = input;
  if (
    typeof userId !== 'string'
    || !/^[a-f\d]{24}$/i.test(userId)
    || typeof teamId !== 'string'
    || !/^[a-f\d]{24}$/i.test(teamId)
    || typeof type !== 'string'
    || !type.trim()
    || typeof minutes !== 'number'
    || !Number.isFinite(minutes)
    || minutes <= 0
  ) {
    throw Object.assign(new Error('Activity requires valid userId, teamId, type, and positive minutes'), { status: 400 });
  }
  const [user, team] = await Promise.all([User.findById(userId), Team.findById(teamId)]);
  if (!user || !team) {
    throw Object.assign(new Error('Activity user or team was not found'), { status: 404 });
  }
  const activity = await Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
  return activity;
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(_input: unknown) {
  if (!_input || typeof _input !== 'object') {
    throw Object.assign(new Error('Team request must be an object'), { status: 400 });
  }
  const input = _input as Record<string, unknown>;
  const { name, mascot } = input;
  const members = input.members ?? [];
  if (
    typeof name !== 'string'
    || !name.trim()
    || typeof mascot !== 'string'
    || !mascot.trim()
    || !Array.isArray(members)
    || !members.every((member) => typeof member === 'string' && /^[a-f\d]{24}$/i.test(member))
  ) {
    throw Object.assign(new Error('Team requires a name, mascot, and valid member IDs'), { status: 400 });
  }
  const users = members.length ? await User.find({ _id: { $in: members } }).select('_id') : [];
  if (users.length !== members.length) {
    throw Object.assign(new Error('One or more team members were not found'), { status: 404 });
  }
  return Team.create({ name: name.trim(), mascot: mascot.trim(), members: users.map(({ _id }) => _id) });
}

export async function getLeaderboard() {
  const totals = await Activity.aggregate([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    { $lookup: { from: Team.collection.name, localField: '_id', foreignField: '_id', as: 'team' } },
    { $unwind: '$team' },
    { $project: { _id: 0, teamName: '$team.name', totalPoints: 1 } },
    { $sort: { totalPoints: -1, teamName: 1 } },
  ]);
  return totals.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) {
    throw Object.assign(new Error('User was not found'), { status: 404 });
  }
  const [activities, workouts] = await Promise.all([
    Activity.find({ user: user._id }).sort({ occurredAt: -1 }).lean(),
    Workout.find().lean(),
  ]);
  const goal = user.fitnessGoal.toLowerCase();
  const activityTypes = activities.map(({ type }) => type.toLowerCase());
  return workouts
    .map((workout) => {
      const focus = workout.focus.toLowerCase();
      const goalMatch = focus === goal;
      const activityMatch = activityTypes.some((type) => type.includes(focus));
      const reason = goalMatch
        ? `Matches your ${user.fitnessGoal} fitness goal${activities[0] ? ` and recent ${activities[0].type} activity` : ''}`
        : activityMatch
          ? `Matches your recent ${activityTypes.find((type) => type.includes(focus))} activity`
          : `Suggested to support your ${user.fitnessGoal} fitness goal`;
      return { ...workout, reason, score: Number(goalMatch) + Number(activityMatch) };
    })
    .sort((left, right) => right.score - left.score || (left.title ?? '').localeCompare(right.title ?? ''))
    .map(({ score: _score, ...suggestion }) => suggestion);
}

export { User };
