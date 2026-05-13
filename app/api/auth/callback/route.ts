import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signParams } from '@/lib/lastfm-sign';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/?auth=failed', request.nextUrl.origin));
  }

  const apiKey = process.env.LASTFM_API_KEY;
  const secret = process.env.LASTFM_SHARED_SECRET;
  if (!apiKey || !secret) {
    console.error('[auth/callback] Missing LASTFM_API_KEY or LASTFM_SHARED_SECRET');
    return NextResponse.redirect(new URL('/?auth=failed&reason=config', request.nextUrl.origin));
  }

  const params = { api_key: apiKey, method: 'auth.getSession', token };
  const sig = signParams(params, secret);

  const url = `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${sig}&format=json`;
  const res = await fetch(url);
  const raw = await res.json();
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (data.error || !data.session) {
    return NextResponse.redirect(new URL(`/?auth=failed&reason=${data.error ?? 'no_session'}`, request.nextUrl.origin));
  }

  const cookieStore = await cookies();
  cookieStore.set('lastfm_session', JSON.stringify({ key: data.session.key, username: data.session.name }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.redirect(new URL('/', request.nextUrl.origin));
}
