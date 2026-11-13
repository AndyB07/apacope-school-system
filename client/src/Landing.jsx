import { useEffect, useRef } from 'react';

const features = [
  ['01', 'Attendance, made clear', 'Take class registers, review attendance trends and spot absences that need attention.'],
  ['02', 'Progress at a glance', 'Record marks and prepare clear, consistent report cards for every learner.'],
  ['03', 'Learning in one place', 'Keep class videos, handouts and learning resources organised by module.'],
  ['04', 'A closer school connection', 'Help families keep up with attendance, results, class updates and important school dates.'],
  ['05', 'Built for every school role', 'Give teachers, school leaders, parents and learners the right tools for their role.'],
  ['06', 'One school, four pathways', 'Bring Nursery, Primary, Secondary and TVET administration together securely.'],
];

const tracks = [
  ['01', 'Nursery', 'Nursery 1–3 · A confident start for every learner.', '/school-classroom.png'],
  ['02', 'Primary', 'P1–P6 · Strong foundations for what comes next.', '/school-parade.png'],
  ['03', 'Secondary', 'O-Level · A clear path from S1 through S3.', '/school-secondary-project.png'],
  ['04', 'TVET', 'L3SWD–L5SWD · Software development skills.', '/school-robotics.png'],
];

export default function Landing({ onLogin }) {
  const landingRef = useRef(null);

  useEffect(() => {
    const landing = landingRef.current;
    if (!landing || !('IntersectionObserver' in window)) return undefined;

    const targets = landing.querySelectorAll('[data-scroll-reveal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });

    landing.classList.add('scroll-reveal-enabled');
    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      landing.classList.remove('scroll-reveal-enabled');
    };
  }, []);

  return <div className="land" ref={landingRef}>
    <nav className="landNav">
      <a className="landBrand" href="#home" aria-label="GSA APACOPE home">
        <img src="/logo.png" alt="" />
        <span><b>GSA APACOPE</b><small>SCHOOL MANAGEMENT</small></span>
      </a>
      <div className="landNavLinks">
        <a href="#platform">Platform</a>
        <a href="#tracks">Education tracks</a>
        <button className="cta" onClick={onLogin}>Sign in <span aria-hidden="true">↗</span></button>
      </div>
    </nav>

    <main id="home">
      <section className="landHero">
        <div className="heroBackdrop" aria-hidden="true">
          <img src="/school-robotics.png" alt="" />
          <img src="/school-classroom.png" alt="" />
          <img src="/school-field-trip.png" alt="" />
          <img src="/school-drumming.png" alt="" />
          <img src="/school-parade.png" alt="" />
          <img src="/school-celebration.png" alt="" />
        </div>
        <div className="heroCopy">
          <span className="eyebrow"><i /> SCHOOL LIFE, BETTER CONNECTED</span>
          <h1>Every part of school.<br /><em>The future begins here.</em></h1>
          <p>One thoughtful space for the people and progress that make Groupe Scolaire APACOPE.</p>
          <div className="heroActions">
            <button className="cta ctaLarge" onClick={onLogin}>Access your workspace <span aria-hidden="true">→</span></button>
            <a className="textLink" href="#platform">Explore the platform <span aria-hidden="true">↓</span></a>
          </div>
          <div className="heroNote"><span className="noteMark">✳</span><span>Made for our school community<br /><b>From Nursery through TVET</b></span></div>
        </div>
        <nav className="heroTracks" aria-label="Education tracks">
          {tracks.map(([number, title]) => <a href="#tracks" key={number}>{title}<span aria-hidden="true">↗</span></a>)}
        </nav>
      </section>

      <section className="landIntro" id="platform">
        <div className="platformIntro">
          <div className="platformIntroCopy" data-scroll-reveal>
            <div className="sectionEyebrow">THE GSA APACOPE PLATFORM</div>
            <div className="introHeading"><h2><em>More room to grow.</em></h2><p>Bring the everyday essentials together, so staff can focus on teaching and every learner can keep moving forward.</p></div>
          </div>
          <img className="platformIntroImage" src="/school-classroom.png" alt="APACOPE teachers and learners learning together" loading="lazy" decoding="async" data-scroll-reveal />
        </div>
        <div className="featureGrid">{features.map(([number, title, detail]) =>
          <article className="landFeature" key={number} data-scroll-reveal>
            <span className="featureNumber">{number}</span>
            <h3>{title}</h3><p>{detail}</p><span className="featureRule" />
          </article>
        )}</div>
      </section>

      <section className="trackSection" id="tracks">
        <div className="trackIntro" data-scroll-reveal><div><div className="sectionEyebrow">ONE SCHOOL, MANY JOURNEYS</div><h2>Every learner<br />has a place here.</h2></div></div>
        <div className="trackGrid">{tracks.map(([number, title, detail, image]) =>
          <article className="trackCard" key={number} data-scroll-reveal>
            <img src={image} alt="" loading="lazy" decoding="async" />
            <div className="trackCardCopy"><span>{number}</span><h3>{title}</h3><p>{detail}</p><i aria-hidden="true">↗</i></div>
          </article>
        )}</div>
      </section>

      <section className="schoolGallery" aria-label="School gallery">
        <div className="galleryIntro" data-scroll-reveal>
          <div>
            <span className="sectionEyebrow">LIFE AT APACOPE</span>
            <h2>Learning, growing<br />and celebrating together.</h2>
          </div>
        </div>
        <figure data-scroll-reveal>
          <img src="/school-classroom.png" alt="Learners and teachers working together in a classroom" loading="lazy" decoding="async" />
          <figcaption><span>Learning together</span><small>A welcoming start for every learner</small></figcaption>
        </figure>
        <figure data-scroll-reveal>
          <img src="/school-drumming.png" alt="Students performing together on traditional drums" loading="lazy" decoding="async" />
          <figcaption><span>Culture in action</span><small>Celebrating talent and tradition</small></figcaption>
        </figure>
        <figure data-scroll-reveal>
          <img src="/school-field-trip.png" alt="Learners visiting an airport on a school trip" loading="lazy" decoding="async" />
          <figcaption><span>Learning beyond the classroom</span><small>Discovering the world together</small></figcaption>
        </figure>
        <figure data-scroll-reveal>
          <img src="/school-parade.png" alt="Students taking part in a school parade" loading="lazy" decoding="async" />
          <figcaption><span>School spirit</span><small>Growing through teamwork</small></figcaption>
        </figure>
        <figure data-scroll-reveal>
          <img src="/school-celebration.png" alt="Students and staff celebrating at a school event" loading="lazy" decoding="async" />
          <figcaption><span>One community</span><small>Making moments worth celebrating</small></figcaption>
        </figure>
      </section>

      <section className="landCta">
        <div data-scroll-reveal><span className="sectionEyebrow">YOUR SCHOOL COMMUNITY, CONNECTED</span><h2>Good things happen<br />when we work together.</h2></div>
        <button className="cta ctaLight" onClick={onLogin} data-scroll-reveal>Sign in to your workspace <span aria-hidden="true">→</span></button>
      </section>
    </main>

    <footer className="landFooter">
      <div className="footerTop">
        <a className="landBrand footerBrand" href="#home"><img src="/logo.png" alt="" /><span><b>GSA APACOPE</b><small>SCHOOL MANAGEMENT</small></span></a>
        <div className="footerContact" aria-label="Contact information">
          <div className="footerContactItem">
            <span className="footerLabel">Phone</span>
            <div className="footerValue"><a href="tel:+250786698298">+250 786 698 298</a><a href="tel:+250252572387">+250 252 572 387</a></div>
          </div>
          <div className="footerContactItem">
            <span className="footerLabel">Email</span>
            <div className="footerValue"><a href="mailto:info@apacope.com">info@apacope.com</a></div>
          </div>
          <div className="footerContactItem">
            <span className="footerLabel">Address</span>
            <div className="footerValue">Avenue de Muhima, Muhima, Nyarugenge District, Kigali, Rwanda</div>
          </div>
        </div>
      </div>
      <div className="footerBottom">
        <span>Groupe Scolaire APACOPE <i /> {new Date().getFullYear()}</span>
        <a href="#home">Back to top <span aria-hidden="true">↑</span></a>
      </div>
    </footer>
  </div>;
}
