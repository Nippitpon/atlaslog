import type { Exercise, Program, Session } from '@atlaslog/shared'

export const EXERCISES: Exercise[] = [
  { id: 'bench', name: 'Bench Press', group: 'Chest', equipment: 'Barbell' },
  { id: 'incline-db', name: 'Incline DB Press', group: 'Chest', equipment: 'Dumbbell' },
  { id: 'cable-fly', name: 'Cable Fly', group: 'Chest', equipment: 'Cable' },
  { id: 'pushup', name: 'Push-Up', group: 'Chest', equipment: 'Bodyweight' },
  { id: 'ohp', name: 'Overhead Press', group: 'Shoulders', equipment: 'Barbell' },
  { id: 'lat-raise', name: 'Lateral Raise', group: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'tricep-pd', name: 'Tricep Pushdown', group: 'Arms', equipment: 'Cable' },
  { id: 'bicep-curl', name: 'Barbell Curl', group: 'Arms', equipment: 'Barbell' },
  { id: 'deadlift', name: 'Deadlift', group: 'Back', equipment: 'Barbell' },
  { id: 'pullup', name: 'Pull-Up', group: 'Back', equipment: 'Bodyweight' },
  { id: 'row', name: 'Barbell Row', group: 'Back', equipment: 'Barbell' },
  { id: 'lat-pd', name: 'Lat Pulldown', group: 'Back', equipment: 'Cable' },
  { id: 'squat', name: 'Back Squat', group: 'Legs', equipment: 'Barbell' },
  { id: 'rdl', name: 'Romanian DL', group: 'Legs', equipment: 'Barbell' },
  { id: 'leg-press', name: 'Leg Press', group: 'Legs', equipment: 'Machine' },
  { id: 'leg-curl', name: 'Leg Curl', group: 'Legs', equipment: 'Machine' },
  { id: 'calf', name: 'Standing Calf Raise', group: 'Legs', equipment: 'Machine' },
  { id: 'plank', name: 'Plank', group: 'Core', equipment: 'Bodyweight' },
  { id: 'cable-crunch', name: 'Cable Crunch', group: 'Core', equipment: 'Cable' },
]

export const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core']

export const PROGRAMS: Program[] = [
  {
    id: 'push', name: 'Push Day', focus: 'Chest · Shoulders · Triceps', duration: 62,
    exercises: [
      { exerciseId: 'bench', sets: [{w:60,r:10},{w:70,r:8},{w:75,r:6},{w:75,r:5}] },
      { exerciseId: 'incline-db', sets: [{w:22,r:10},{w:24,r:10},{w:26,r:8}] },
      { exerciseId: 'ohp', sets: [{w:40,r:8},{w:45,r:6},{w:45,r:6}] },
      { exerciseId: 'lat-raise', sets: [{w:8,r:15},{w:10,r:12},{w:10,r:12}] },
      { exerciseId: 'tricep-pd', sets: [{w:25,r:12},{w:30,r:10},{w:30,r:10}] },
    ],
  },
  {
    id: 'pull', name: 'Pull Day', focus: 'Back · Biceps', duration: 58,
    exercises: [
      { exerciseId: 'deadlift', sets: [{w:100,r:6},{w:120,r:4},{w:130,r:3}] },
      { exerciseId: 'pullup', sets: [{w:0,r:8},{w:0,r:7},{w:0,r:6}] },
      { exerciseId: 'row', sets: [{w:60,r:10},{w:70,r:8},{w:70,r:8}] },
      { exerciseId: 'lat-pd', sets: [{w:50,r:12},{w:55,r:10},{w:55,r:10}] },
      { exerciseId: 'bicep-curl', sets: [{w:25,r:12},{w:30,r:10},{w:30,r:8}] },
    ],
  },
  {
    id: 'legs', name: 'Leg Day', focus: 'Quads · Hamstrings · Glutes', duration: 70,
    exercises: [
      { exerciseId: 'squat', sets: [{w:80,r:8},{w:100,r:5},{w:110,r:4},{w:110,r:3}] },
      { exerciseId: 'rdl', sets: [{w:80,r:10},{w:90,r:8},{w:90,r:8}] },
      { exerciseId: 'leg-press', sets: [{w:140,r:12},{w:160,r:10},{w:180,r:8}] },
      { exerciseId: 'leg-curl', sets: [{w:35,r:12},{w:40,r:10},{w:40,r:10}] },
      { exerciseId: 'calf', sets: [{w:60,r:15},{w:70,r:12},{w:70,r:12}] },
    ],
  },
  {
    id: 'full', name: 'Full Body', focus: 'Compound · Time-efficient', duration: 45,
    exercises: [
      { exerciseId: 'squat', sets: [{w:80,r:8},{w:90,r:6},{w:90,r:6}] },
      { exerciseId: 'bench', sets: [{w:60,r:8},{w:70,r:6},{w:70,r:6}] },
      { exerciseId: 'row', sets: [{w:60,r:10},{w:65,r:8},{w:65,r:8}] },
      { exerciseId: 'ohp', sets: [{w:40,r:8},{w:40,r:8}] },
      { exerciseId: 'plank', sets: [{w:0,r:60},{w:0,r:60}] },
    ],
  },
  {
    id: 'upper', name: 'Upper Body', focus: 'Chest · Back · Arms', duration: 55,
    exercises: [
      { exerciseId: 'bench', sets: [{w:60,r:10},{w:70,r:8},{w:75,r:6}] },
      { exerciseId: 'row', sets: [{w:60,r:10},{w:70,r:8},{w:70,r:8}] },
      { exerciseId: 'incline-db', sets: [{w:22,r:10},{w:24,r:10}] },
      { exerciseId: 'lat-pd', sets: [{w:50,r:12},{w:55,r:10}] },
      { exerciseId: 'bicep-curl', sets: [{w:25,r:12},{w:30,r:10}] },
      { exerciseId: 'tricep-pd', sets: [{w:25,r:12},{w:30,r:10}] },
    ],
  },
]

export function makeSeedHistory(): Session[] {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const daysAgo = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() - n)
    return d.toISOString()
  }
  return [
    {
      id: 'h1', programId: 'push', name: 'Push Day', date: daysAgo(1),
      duration: 64, volume: 6420, setCount: 18,
      exercises: [
        { exerciseId: 'bench', sets: [{w:60,r:10,done:true},{w:70,r:8,done:true},{w:75,r:6,done:true},{w:75,r:5,done:true}] },
        { exerciseId: 'incline-db', sets: [{w:22,r:10,done:true},{w:24,r:10,done:true},{w:26,r:8,done:true}] },
        { exerciseId: 'ohp', sets: [{w:40,r:8,done:true},{w:45,r:6,done:true},{w:45,r:6,done:true}] },
        { exerciseId: 'lat-raise', sets: [{w:10,r:12,done:true},{w:10,r:12,done:true},{w:10,r:12,done:true}] },
        { exerciseId: 'tricep-pd', sets: [{w:30,r:10,done:true},{w:30,r:10,done:true},{w:30,r:10,done:true}] },
      ],
    },
    { id: 'h2', programId: 'legs', name: 'Leg Day', date: daysAgo(3), duration: 72, volume: 9840, setCount: 19 },
    { id: 'h3', programId: 'pull', name: 'Pull Day', date: daysAgo(5), duration: 56, volume: 7150, setCount: 17 },
    { id: 'h4', programId: 'push', name: 'Push Day', date: daysAgo(8), duration: 61, volume: 6180, setCount: 18 },
    { id: 'h5', programId: 'full', name: 'Full Body', date: daysAgo(10), duration: 48, volume: 4820, setCount: 14 },
    { id: 'h6', programId: 'legs', name: 'Leg Day', date: daysAgo(12), duration: 68, volume: 9220, setCount: 18 },
    { id: 'h7', programId: 'pull', name: 'Pull Day', date: daysAgo(15), duration: 54, volume: 6890, setCount: 17 },
    { id: 'h8', programId: 'upper', name: 'Upper Body', date: daysAgo(17), duration: 52, volume: 5640, setCount: 15 },
  ]
}
