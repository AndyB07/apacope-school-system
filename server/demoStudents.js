const FIRST_NAMES = [
  'Aline', 'Jean', 'Grace', 'Eric', 'Divine', 'Patrick',
  'Keza', 'Emmanuel', 'Chantal', 'Fabrice', 'Irene', 'Samuel',
  'Diane', 'Claude', 'Olive', 'Peter', 'Ange', 'Theogene',
];

const LAST_NAMES = ['Uwimana', 'Niyonsenga', 'Mukamana', 'Habimana', 'Uwamahoro'];
const LEGACY_STUDENTS = [
  ['Aline', 'Uwimana'],
  ['Jean', 'Niyonsenga'],
  ['Grace', 'Mukamana'],
  ['Eric', 'Habimana'],
  ['Divine', 'Uwamahoro'],
  ['Patrick', 'Nkurunziza'],
];

export const DEMO_STUDENT_COUNT = FIRST_NAMES.length * LAST_NAMES.length;
export const DEMO_STUDENTS_PER_CLASS = 6;

export const demoStudentName = studentNumber => {
  const index = studentNumber - 1;
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName = LAST_NAMES[Math.floor(index / FIRST_NAMES.length)];
  if (!firstName || !lastName) return `Learner Demo${studentNumber}`;
  return `${firstName} ${lastName}`;
};

export const legacyDemoStudentName = (rollNo, level) => {
  const [firstName, lastName] = LEGACY_STUDENTS[rollNo - 1] || [];
  return firstName && lastName ? [`${firstName} ${lastName}`, `${firstName} ${level.replace(/\s+/g, '')}`] : [];
};
