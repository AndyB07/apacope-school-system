export default function StudentIdentity({ name, level, track }) {
  return <span className="studentIdentity">{name}{level ? ` (${level})` : ''}</span>;
}
