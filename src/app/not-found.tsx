/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import { tServer } from "@/lib/i18nServer";
export default function NotFound() {
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
            <p style={{ fontSize: '1.5rem', opacity: 0.7 }}>{tServer("Page not found")}</p>
            <Link href="/" style={{ marginTop: '2rem', color: '#fff', textDecoration: 'underline' }}>
                {tServer("Go home")}
            </Link>
        </div>
    );
}
