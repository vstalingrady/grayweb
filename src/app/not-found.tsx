import Link from "next/link";
import { tServer } from "@/lib/i18nServer";
export default async function NotFound() {
    const pageNotFound = await tServer("Page not found");
    const goHome = await tServer("Go home");
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#000',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif'
        }}>
            <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
            <p style={{ fontSize: '1.5rem', opacity: 0.7 }}>{pageNotFound}</p>
            <Link href="/" style={{ marginTop: '2rem', color: '#fff', textDecoration: 'underline' }}>
                {goHome}
            </Link>
        </div>
    );
}
