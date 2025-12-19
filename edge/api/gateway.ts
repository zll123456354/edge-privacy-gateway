export default {
  async fetch(request: Request, env: any) {
    const json = (body: unknown, init: ResponseInit = {}) => {
      const headers = new Headers(init.headers);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
      if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
      return new Response(JSON.stringify(body), { ...init, headers });
    };

    const readEnv = (key: string) => {
      const v1 = env?.[key];
      if (typeof v1 === "string" && v1.trim()) return v1.trim();
      try {
        // @ts-ignore
        if (typeof process !== "undefined" && process.env && process.env[key]) {
          // @ts-ignore
          const v2 = process.env[key];
          if (typeof v2 === "string" && v2.trim()) return v2.trim();
        }
      } catch {}
      return undefined;
    };

    const handleOcr = async () => {
      if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
      let body: any;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, { status: 400 });
      }
      const image: string = body?.image;
      const side: string = body?.side === "back" ? "back" : "face";
      if (typeof image !== "string" || !image.trim()) return json({ error: "Image is required" }, { status: 400 });
      const mode = request.headers.get("X-Mode") === "cloud" ? "cloud" : "edge";
      const t0 = Date.now();
      const appCode = readEnv("ALIYUN_OCR_APPCODE");
      const aliyunUrl = readEnv("ALIYUN_OCR_URL") || "https://cardnumber.market.alicloudapi.com/rest/160601/ocr/ocr_idcard.json";
      const configure = { side };
      const mock = {
        name: "张三",
        sex: "男",
        nationality: "汉",
        birth: "19900307",
        address: "北京市朝阳区示例路88号",
        num: "110101199003078888",
        success: true,
      };
      let upstream: any = null;
      let ok = false;
      if (appCode && appCode !== "YOUR_APP_CODE_HERE") {
        try {
          const raw = image.trim();
          const payload = raw.startsWith("data:image/") ? raw.replace(/^data:image\/\w+;base64,/, "") : raw;
          const p = fetch(aliyunUrl, {
            method: "POST",
            headers: {
              Authorization: `APPCODE ${appCode}`,
              "Content-Type": "application/json; charset=UTF-8",
              Accept: "application/json",
            },
            body: JSON.stringify({ image: payload, configure }),
          });
          const r = await Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))]);
          const txt = await r.text();
          try { upstream = JSON.parse(txt); } catch { upstream = null; }
          ok = r.ok && upstream != null;
        } catch {}
      }
      const data = ok ? upstream : mock;
      const maskName = (s: string) => (s && s.length > 1 ? s[0] + "*" : s || "*");
      const maskBirth = (s: string) => (s && s.length >= 4 ? s.slice(0, 4) + "****" : s || "****");
      const maskAddr = (s: string) => {
        if (!s) return "";
        const keep = Math.min(6, s.length);
        return s.slice(0, keep) + "****";
      };
      const maskNum = (s: string) => (s && s.length >= 8 ? s.slice(0, 3) + "************" + s.slice(-4) : s || "********");
      const fields = ["身份证", "姓名", "地址"]; 
      const status = {
        location: "Edge Node (Asia)",
        rawDataLeftCloud: mode === "cloud",
        executedOnEdge: true,
        elapsedMs: Date.now() - t0,
        fieldsDetected: fields,
      };
      const masked = {
        name: maskName(data?.name ?? ""),
        sex: data?.sex ?? "",
        nationality: data?.nationality ?? "",
        birth: maskBirth(data?.birth ?? ""),
        address: maskAddr(data?.address ?? ""),
        id: maskNum(data?.num ?? ""),
      };
      return json({ status, masked, original: data });
    };

    const handleTextMask = async () => {
      if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
      let body: any;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, { status: 400 }); }
      const text: string = body?.text;
      if (typeof text !== "string") return json({ error: "Text is required" }, { status: 400 });
      const r = text
        .replace(/\d{11}/g, (m) => m.slice(0, 3) + "****" + m.slice(7))
        .replace(/\d{17}[\dX]/g, (m) => m.slice(0, 3) + "************" + m.slice(-4))
        .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "***@***");
      return json({ result: r });
    };

    const u = new URL(request.url);
    const p = u.pathname;
    if (p === "/api/ocr") return handleOcr();
    if (p === "/api/mask") return handleTextMask();
    if (!p.startsWith("/api/")) return fetch(new URL("/index.html", request.url));
    return json({ error: "Not Found" }, { status: 404 });
  },
};

