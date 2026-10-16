import { Link } from 'react-router-dom';
import arionMedicalLogo from '../assets/arion-medical-logo.png';

export default function Brand() {
  return <Link className="brand" to="/" aria-label="Arion Health Portal home"><img className="brand-logo" src={arionMedicalLogo} alt="" /><span>Arion Health Portal<small>Your Health. Our Priority.</small></span></Link>;
}

