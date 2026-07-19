import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageContainer } from "@/components/layout/PageContainer";
import { PropertyCard } from "@/components/property/PropertyCard";
import { PropertyGrid } from "@/components/property/PropertyGrid";
import {
  SearchIcon,
  HeartIcon,
  ClockIcon,
  ZapIcon,
  ShieldIcon,
  SparklesIcon,
} from "@/components/icons";

// Propiedades ilustrativas SOLO para el preview de la landing. En la app real
// esta data se scrapea en vivo y NO se persiste (regla de oro del modelo).
const DEMO_PROPERTIES = [
  {
    externalId: "demo-1",
    title: "Departamento 2D/2B con vista al parque, Providencia",
    price: "UF 4.850",
    imageUrl: "https://picsum.photos/seed/portalprop-1/800/600",
    url: "#",
    location: "Providencia, Santiago",
  },
  {
    externalId: "demo-2",
    title: "Casa mediterránea 4D/3B con jardín, Las Condes",
    price: "UF 12.300",
    imageUrl: "https://picsum.photos/seed/portalprop-2/800/600",
    url: "#",
    location: "Las Condes, Santiago",
  },
  {
    externalId: "demo-3",
    title: "Studio full amoblado a pasos del metro, Ñuñoa",
    price: "$ 89.000.000",
    imageUrl: "https://picsum.photos/seed/portalprop-3/800/600",
    url: "#",
    location: "Ñuñoa, Santiago",
  },
  {
    externalId: "demo-4",
    title: "Loft industrial reciclado en barrio Italia",
    price: null,
    imageUrl: null,
    url: "#",
    location: "Providencia, Santiago",
  },
];

const FEATURES = [
  {
    icon: ZapIcon,
    title: "Búsqueda en vivo",
    description:
      "Cada consulta scrapea Portal Inmobiliario en el momento por HTTP directo. Sin catálogos viejos: lo que ves es lo que hay publicado ahora.",
  },
  {
    icon: HeartIcon,
    title: "Favoritos con snapshot",
    description:
      "Guardá una propiedad y conservá su título, precio e imagen del momento en que la marcaste — aunque la publicación luego desaparezca.",
  },
  {
    icon: ClockIcon,
    title: "Historial de búsquedas",
    description:
      "Todas tus búsquedas quedan registradas y accesibles, y cada día te llegan por correo automáticamente.",
  },
  {
    icon: ShieldIcon,
    title: "Trazabilidad total",
    description:
      "Login, búsqueda, scraping, clicks y favoritos quedan en una bitácora reconstruible de punta a punta con una sola consulta.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="border-border relative overflow-hidden border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]"
        />
        <PageContainer className="relative flex flex-col items-center gap-6 py-16 text-center sm:py-24">
          <Badge variant="primary" className="gap-1.5">
            <SparklesIcon className="size-3.5" />
            Scraping en vivo desde Portal Inmobiliario
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Encontrá tu próxima propiedad con datos{" "}
            <span className="text-primary">siempre frescos</span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty">
            Buscá por comuna o dirección y obtené resultados en tiempo real,
            guardá tus favoritos y seguí tu historial. Nada de catálogos
            desactualizados.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">Comenzar gratis</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/search">
                <SearchIcon className="size-5" />
                Explorar propiedades
              </Link>
            </Button>
          </div>
        </PageContainer>
      </section>

      {/* Features */}
      <PageContainer className="py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Todo lo que necesitás para buscar mejor
          </h2>
          <p className="text-muted-foreground mt-3 text-pretty">
            Una plataforma que respeta un principio simple: la base de datos
            guarda solo tu estado, nunca el catálogo del portal.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="border-border bg-card flex flex-col gap-3 rounded-[var(--radius-card)] border p-5 shadow-sm"
            >
              <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                <Icon className="size-6" />
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-muted-foreground text-sm text-pretty">
                {description}
              </p>
            </div>
          ))}
        </div>
      </PageContainer>

      {/* Preview del catálogo */}
      <section className="border-border bg-card/40 border-t">
        <PageContainer className="py-16">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Así se ve el catálogo
              </h2>
              <p className="text-muted-foreground mt-2">
                Resultados clickeables que te llevan directo a la publicación
                original.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/search">
                <SearchIcon className="size-5" />
                Ir a buscar
              </Link>
            </Button>
          </div>
          <PropertyGrid>
            {DEMO_PROPERTIES.map((p) => (
              <PropertyCard key={p.externalId} {...p} />
            ))}
          </PropertyGrid>
          <p className="text-muted-foreground mt-6 text-center text-xs">
            Propiedades ilustrativas. En la plataforma, cada búsqueda trae datos
            reales y en vivo.
          </p>
        </PageContainer>
      </section>

      {/* CTA final */}
      <PageContainer className="py-20">
        <div className="border-border from-primary/10 mx-auto flex max-w-3xl flex-col items-center gap-6 rounded-[var(--radius-card)] border bg-gradient-to-b to-transparent p-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            ¿Listo para empezar a buscar?
          </h2>
          <p className="text-muted-foreground max-w-md text-pretty">
            Creá tu sesión y accedé al buscador en vivo. Sin sesión no se puede
            buscar — es parte de mantener tu historial y favoritos a salvo.
          </p>
          <Button asChild size="lg">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </PageContainer>
    </>
  );
}
