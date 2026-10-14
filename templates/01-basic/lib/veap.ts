import {
  Application,
  COOKIE_STORE,
  REQUEST_CONTEXT,
  ServiceProvider,
} from "@veap/kernel";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Next.js transport provider registering cookie and header adapters into IoC
 */
class NextTransportServiceProvider extends ServiceProvider {
  register(): void {
    this.container.register({
      token: COOKIE_STORE,
      useValue: {
        async get(name: string) {
          try {
            return (await cookies()).get(name)?.value ?? null;
          } catch {
            return null;
          }
        },
        async set(name: string, value: string, options?: any) {
          try {
            (await cookies()).set(name, value, options);
          } catch {}
        },
        async delete(name: string) {
          try {
            (await cookies()).delete(name);
          } catch {}
        },
      },
      singleton: true,
    });

    this.container.register({
      token: REQUEST_CONTEXT,
      useValue: {
        async getHeader(name: string) {
          try {
            return (await headers()).get(name);
          } catch {
            return null;
          }
        },
        redirect(url: string) {
          redirect(url);
        },
      },
      singleton: true,
    });
  }
}

export const app = Application.configure()
  .use(NextTransportServiceProvider)
  .create();

let bootstrapPromise: Promise<any> | null = null;

/**
 * Main system bootstrap function.
 * Boots modular services, runs migrations, and seeds demo data.
 * Safe for concurrent invocations across layouts, pages, and server actions.
 */
export async function initializeSystem(): Promise<any> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      return await app.bootstrap();
    })().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}
