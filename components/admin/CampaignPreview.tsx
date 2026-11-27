import React from "react";

const policy = "default-src 'none'; style-src 'unsafe-inline'; img-src data: https://*.supabase.co https://www.neejee.com; base-uri 'none'; form-action 'none'";

export function CampaignPreview({html}: {html: string}) {
  return <iframe
    title="Email campaign preview"
    sandbox=""
    referrerPolicy="no-referrer"
    className="w-full h-80 bg-white border border-mitti/20"
    srcDoc={`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}">${html}`}
  />;
}
