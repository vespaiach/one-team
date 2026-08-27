"use client";

import { I18nProvider } from "react-aria-components/I18nProvider";

export function ClientProviders({
  lang,
  children,
}: {
  lang: string;
  children: React.ReactNode;
}) {
  return <I18nProvider locale={lang}>{children}</I18nProvider>;
}
