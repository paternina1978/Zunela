import Image from "next/image";

const values = [
  {
    title: "Personas",
    text: "Descubre perfiles que se complementan con lo que buscas y lo que ofreces.",
  },
  {
    title: "Oportunidades",
    text: "Únete a iniciativas existentes. Crear las tuyas será una ventaja Premium.",
  },
  {
    title: "Comunidades",
    text: "Entra a espacios públicos y, más adelante, a círculos privados por invitación.",
  },
  {
    title: "Confianza",
    text: "Tus contactos no se muestran. El vínculo solo se abre si hay interés recíproco.",
  },
];

export function BrandPanel() {
  return (
    <section className="contents lg:flex lg:flex-col lg:justify-center">
      <div className="rise-in order-1 px-6 pt-8 sm:px-10 lg:order-none lg:px-10 lg:pt-16">
        <Image
          src="/logo-zunela.png"
          alt="ZUNELA"
          width={1002}
          height={795}
          priority
          className="h-auto w-40 sm:w-52"
        />

        <p className="mt-5 text-[11px] font-semibold tracking-[0.28em] text-teal uppercase">
          Colombia · Afinidades
        </p>

        <h1 className="mt-3 max-w-xl font-display text-4xl leading-[1.1] font-semibold text-navy sm:text-5xl">
          Conecta con{" "}
          <em className="italic font-medium text-teal">tu gente</em>.
        </h1>

        <p className="mt-4 max-w-lg text-base leading-7 text-muted">
          Di qué buscas y qué puedes aportar. ZUNELA acerca aliados,
          conocimientos, comunidades y oportunidades compatibles, con
          consentimiento y sin exponer tus datos de contacto.
        </p>
      </div>

      <ul className="rise-in order-3 mt-6 grid gap-3 px-6 pb-10 sm:grid-cols-2 sm:px-10 lg:order-none lg:mt-8 lg:px-10 lg:pb-16">
        {values.map((item) => (
          <li
            key={item.title}
            className="rounded-2xl border border-line bg-white/70 p-4 backdrop-blur-sm"
          >
            <p className="text-sm font-semibold text-navy">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
