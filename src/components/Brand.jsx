import { Link } from 'react-router-dom';
export default function Brand() {
  return <Link className="brand" to="/" aria-label="Arion Health Portal home"><span className="brand-mark" aria-hidden="true">✚</span><span>Arion Health Portal<small>Your Health. Our Priority.</small></span></Link>;
}

