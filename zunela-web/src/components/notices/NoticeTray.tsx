"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  markNoticesSeenAsync,
  noticeKindLabel,
  readVisibleNotices,
  refreshRemoteNotices,
  unreadVisibleCount,
  type Notice,
} from "@/lib/notices";

export function NoticeTray() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  async function reload() {
    await refreshRemoteNotices();
    setItems(readVisibleNotices().slice(0, 8));
    setUnread(unreadVisibleCount());
  }

  useEffect(() => {
    void reload();
    function onFocus() {
      void reload();
    }
    function onNotices() {
      void reload();
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener("zunela-notices", onNotices);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("zunela-notices", onNotices);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      void reload();
    }
  }

  async function markAll() {
    await markNoticesSeenAsync();
    window.dispatchEvent(new Event("zunela-notices"));
    await reload();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-navy uppercase hover:border-teal"
      >
        Avisos
        {unread > 0 ? (
          <span className="rounded-full bg-teal px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Avisos recientes"
          className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,20rem)] rounded-2xl border border-gold/35 bg-card p-3 shadow-[0_18px_40px_rgba(7,21,31,0.12)]"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Recientes</p>
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0}
              className="text-xs font-semibold text-teal disabled:opacity-40"
            >
              Marcar leídos
            </button>
          </div>
          {items.length === 0 ? (
            <p className="mt-3 px-1 text-sm leading-6 text-muted">No hay avisos visibles.</p>
          ) : (
            <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={noticeHref(item)}
                    onClick={() => {
                      void (async () => {
                        await markNoticesSeenAsync([item.id]);
                        window.dispatchEvent(new Event("zunela-notices"));
                        setOpen(false);
                      })();
                    }}
                    className={`block rounded-xl px-3 py-2 text-left hover:bg-cream-deep ${
                      item.seen ? "opacity-80" : "bg-cream-deep/70"
                    }`}
                  >
                    <p className="text-[10px] font-semibold tracking-wide text-gold uppercase">
                      {noticeKindLabel(item.kind)}
                      {!item.seen ? " · nuevo" : ""}
                    </p>
                    <p className="mt-0.5 text-sm leading-5 text-navy">{item.text}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/cuenta#avisos"
            onClick={() => setOpen(false)}
            className="mt-3 block px-1 text-center text-xs font-semibold text-teal hover:text-teal-deep"
          >
            Ver todos en Cuenta
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function noticeHref(item: Notice) {
  const source = item.source || "";
  const matchIn = source.match(/^match-in-(.+)$/);
  if (matchIn) {
    return `/descubrir/personas/${matchIn[1]}`;
  }
  const mensaje = source.match(/^mensaje-(?:seed-)?(.+)$/);
  if (mensaje) {
    return `/mensajes/${mensaje[1]}`;
  }
  const community =
    source.match(/^(?:req-|admit-|reject-|join-|post-|invite-)(.+)$/) ||
    source.match(/^comunidad-(.+)$/);
  if (community) {
    return `/descubrir/comunidades/${community[1]}`;
  }
  if (item.kind === "match") {
    return "/matches";
  }
  if (item.kind === "mensaje") {
    return "/mensajes";
  }
  if (item.kind === "comunidad") {
    return "/descubrir";
  }
  return "/cuenta#avisos";
}
