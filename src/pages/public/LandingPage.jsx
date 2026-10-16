import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clinicExterior from '../../assets/arion-clinic-exterior.jpg';
import clinicReception from '../../assets/arion-clinic-reception.jpg';

const highlights = [
  ['calendar', 'Book Appointments', 'Schedule your visit with an Arion clinic doctor.'],
  ['record', 'Access Your Records', 'Keep your visit history and medical certificates in one place.'],
  ['people', 'Quality Healthcare', 'Stay connected with your clinic’s doctors and support staff.'],
];
const clinicAddress = '20 Indonesia Street, corner France Street, Better Living Subdivision, Parañaque City, 1700 Metro Manila';
const clinicMapUrl = 'https://www.google.com/maps/place/Arion+Medical+Surgical+Clinic/@14.4838328,121.0312203,17z/data=!3m1!4b1!4m6!3m5!1s0x3397cefe64cfa843:0x46d9ccab0fec5f7a!8m2!3d14.4838328!4d121.0312203!16s%2Fg%2F11bzw05dpn';
const clinicMapEmbedUrl = 'https://www.google.com/maps?q=Arion%20Medical%20Surgical%20Clinic%2C%2020%20Indonesia%20Street%2C%20Para%C3%B1aque&z=17&output=embed';
const clinicPhotos = [
  {
    src: clinicExterior,
    alt: 'Exterior of Arion Medical Surgical Clinic at the corner of Indonesia and France Streets',
    caption: 'Arion Medical Surgical Clinic',
  },
  {
    src: clinicReception,
    alt: 'Reception area inside Arion Medical Surgical Clinic',
    caption: 'Inside Arion Medical Surgical Clinic',
  },
];
function FeatureIcon({ kind }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'calendar' ? <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 11h16m-12 4 3 3 5-5" /></>
      : kind === 'record' ? <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6" /></>
      : <><circle cx="12" cy="7" r="3" /><path d="M6 21v-3a6 6 0 0 1 12 0v3M4 5a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M2 19v-3a4 4 0 0 1 3-4m17 7v-3a4 4 0 0 0-3-4" /></>}
  </svg>;
}
export default function LandingPage() {
  const [activeClinicPhoto, setActiveClinicPhoto] = useState(0);

  useEffect(() => {
    const rotation = window.setInterval(() => {
      setActiveClinicPhoto((current) => (current + 1) % clinicPhotos.length);
    }, 5000);

    return () => window.clearInterval(rotation);
  }, []);

  const showClinicPhoto = (index) => setActiveClinicPhoto(index);

  return <div className="landing-content">
    <section className="landing-hero" aria-labelledby="welcome-title">
      <div className="hero-copy"><p className="eyebrow">Your Health. Our Priority.</p>
        <h1 id="welcome-title">Welcome to<br />Arion Health Portal</h1>
        <p className="hero-lead">Accessible. Reliable. Patient-centered care.</p>
        <p>Book appointments with an Arion clinic doctor, view your medical records, and stay connected with the clinic — all in one place.</p>
        <div className="hero-actions"><Link className="public-button primary" to="/login">Login <span aria-hidden="true">→</span></Link><Link className="public-button secondary" to="/register">Register</Link></div>
      </div>
      <figure className="hero-art clinic-photo-carousel" aria-roledescription="carousel" aria-label="Arion Medical Surgical Clinic photos">
        <div className="clinic-photo-slides" aria-live="off">
          {clinicPhotos.map((photo, index) => <img
            key={photo.src}
            className={`clinic-photo-slide${index === activeClinicPhoto ? ' is-active' : ''}`}
            src={photo.src}
            alt={index === activeClinicPhoto ? photo.alt : ''}
            aria-hidden={index !== activeClinicPhoto}
          />)}
        </div>
        <figcaption>{clinicPhotos[activeClinicPhoto].caption}</figcaption>
        <div className="clinic-carousel-controls">
          {clinicPhotos.map((photo, index) => <button
            key={photo.src}
            type="button"
            className={index === activeClinicPhoto ? 'is-active' : ''}
            aria-label={`Show clinic photo ${index + 1}`}
            aria-current={index === activeClinicPhoto ? 'true' : undefined}
            onClick={() => showClinicPhoto(index)}
          />)}
        </div>
      </figure>
    </section>
    <section className="landing-highlights" aria-label="Your patient portal">
      {highlights.map(([kind, title, description]) => <article key={kind}><span className="feature-icon"><FeatureIcon kind={kind} /></span><h2>{title}</h2><p>{description}</p></article>)}
    </section>
    <section className="clinic-location-section" aria-labelledby="clinic-location-title">
      <div className="map-preview"><iframe title="Map showing Arion Medical Surgical Clinic" src={clinicMapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /></div>
      <div className="location-copy"><p className="eyebrow">Visit our clinic</p><h2 id="clinic-location-title">Care close to your community</h2><p>Find Arion Medical Surgical Clinic in Better Living Subdivision, Parañaque City.</p><address>{clinicAddress}</address><div className="clinic-phone"><span>Call the Clinic</span><a href="tel:+63288210577">(02) 8821 0577</a></div><a className="public-button secondary" href={clinicMapUrl} target="_blank" rel="noreferrer">Get Directions <span aria-hidden="true">↗</span></a></div>
    </section>
  </div>;
}

