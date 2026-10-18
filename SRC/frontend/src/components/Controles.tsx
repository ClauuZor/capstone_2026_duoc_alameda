import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from "react";

const control =
  "h-10 w-full rounded-md border border-borde-fuerte bg-superficie px-3 text-texto placeholder:text-texto-suave/70 focus:border-vidrio focus:outline-none focus-visible:outline-2 focus-visible:outline-vidrio";

export function Campo({ etiqueta, id, children, className = "" }: { etiqueta: string; id: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-texto-suave">
        {etiqueta}
      </label>
      {children}
    </div>
  );
}

export const Selector = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className={`${control} ${props.className ?? ""}`} />;
export const Entrada = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`${control} ${props.className ?? ""}`} />;

export function Encabezado({ titulo, descripcion, extra }: { titulo: string; descripcion?: ReactNode; extra?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight [font-stretch:110%]">{titulo}</h1>
        {descripcion && <div className="mt-1 text-texto-suave">{descripcion}</div>}
      </div>
      {extra}
    </header>
  );
}
