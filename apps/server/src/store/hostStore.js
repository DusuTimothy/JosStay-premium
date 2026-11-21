import crypto from "node:crypto";
import { HttpError } from "../lib/http.js";
import { getClient, isDatabaseEnabled, query } from "../lib/postgres.js";
import { bookings } from "./demoStore.js";
import { mapPropertyRow } from "./mappers.js";

const DEMO_HOST_LISTINGS = [
  {
    id: "demo-host-1",
    slug: "crestview-boutique-hotel",
    name: "Crestview Boutique Hotel",
    type: "hotel",
    area: "Jos North",
    price: 85000,
    weekendPrice: 95000,
    status: "Live",
    verified: true,
    photoCount: 4,
    verificationStatus: "verified",
  },
];

const DEMO_HOST_BOOKINGS = [
  { guest: "Adaeze Okafor", property: "Crestview Boutique Hotel", unit: "Deluxe Room", dates: "5 – 8 Dec 2026", status: "Confirmed", gross: 301000, reference: "JS-8F2K1Q" },
  { guest: "Tunde Adewale", property: "Crestview Boutique Hotel", unit: "Executive Suite", dates: "12 – 14 Dec 2026", status: "Confirmed", gross: 260000, reference: "JS-HST101" },
  { guest: "Fatima Bello", property: "Crestview Boutique Hotel", unit: "Deluxe Room", dates: "28 – 30 Nov 2026", status: "Pending", gross: 181000, reference: "JS-HST102" },
];

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "listing";

const toIsoDate = (value) => String(value || "").slice(0, 10);

const toListingResponse = (row) => {
  const mapped = mapPropertyRow(row);
  const verificationStatus = row.verification_status || (row.verified ? "verified" : row.is_published ? "verified" : "draft");
  const status =
    row.is_published
      ? "Live"
      : verificationStatus === "pending_review"
        ? "In review"
        : verificationStatus === "rejected"
          ? "Rejected"
          : verificationStatus === "suspended"
            ? "Suspended"
            : "Draft";
  return {
    id: mapped.id,
    propertyId: mapped.id,
    slug: mapped.slug,
    name: mapped.name,
    type: mapped.type,
    area: mapped.area,
    address: mapped.address,
    description: mapped.description,
    summary: mapped.summary,
    price: mapped.price,
    weekendPrice: row.weekend_price ?? mapped.price,
    status,
    verificationStatus,
    verified: Boolean(mapped.verified),
    isPublished: Boolean(row.is_published),
    photoCount: Array.isArray(mapped.images) ? mapped.images.length : 0,
    images: mapped.images || [],
    property: { ...mapped, weekendPrice: row.weekend_price ?? mapped.price, verificationStatus, status },
  };
};

const requireHost = async (auth) => {
  const host = await findHostByUserId(auth?.userId);
  if (host) return host;
  // Admins can manage platform-owned listings, so provision a host profile on first use.
  if (auth?.role === "admin" && auth?.userId) {
    return ensureHostProfile({
      userId: auth.userId,
      name: auth.email ? String(auth.email).split("@")[0] : "JosStay Admin",
    });
  }
  throw new HttpError(403, "Host profile required");
};

const getOwnedPropertyRow = async (hostId, propertyId) => {
  const { rows } = await query(
    `${HOST_PROPERTY_SELECT}
     where p.id = $1::uuid and p.host_id = $2::uuid
     limit 1`,
    [propertyId, hostId],
  );
  return rows[0] || null;
};

const replaceListingImages = async (client, propertyId, images = []) => {
  if (!Array.isArray(images)) return;
  await client.query(`delete from public.property_images where property_id = $1::uuid`, [propertyId]);
  const normalized = images
    .filter((img) => img && typeof img.url === "string" && img.url.startsWith("https://"))
    .slice(0, 30)
    .map((img, idx) => ({
      url: img.url,
      alt: img.alt ? String(img.alt).slice(0, 160) : null,
      position: Number.isInteger(img.position) ? img.position : idx,
    }));
  for (let i = 0; i < normalized.length; i += 1) {
    const item = normalized[i];
    await client.query(
      `insert into public.property_images (property_id, url, alt, position)
       values ($1::uuid, $2, $3, $4)
       on conflict (property_id, position) do update set url = excluded.url, alt = excluded.alt`,
      [propertyId, item.url, item.alt, i],
    );
  }
};

const insertListingDocuments = async (client, hostId, propertyId, documents = []) => {
  if (!Array.isArray(documents) || !documents.length) return;
  for (const doc of documents.slice(0, 20)) {
    if (!doc || !doc.documentType) continue;
    const metaNoteParts = [];
    if (doc.publicId) metaNoteParts.push(`publicId:${String(doc.publicId).slice(0, 200)}`);
    if (doc.notes) metaNoteParts.push(String(doc.notes).slice(0, 700));
    const notes = metaNoteParts.join(" | ").slice(0, 1000) || null;
    await client.query(
      `insert into public.host_verification_documents
         (host_id, property_id, document_type, file_name, file_url, mime_type, status, notes)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)`,
      [
        hostId,
        propertyId,
        String(doc.documentType),
        doc.fileName ? String(doc.fileName).slice(0, 200) : (doc.publicId ? String(doc.publicId).slice(0, 200) : null),
        doc.fileUrl || null,
        doc.mimeType ? String(doc.mimeType).slice(0, 120) : null,
        doc.status || "submitted",
        notes,
      ],
    );
  }
};

export const findHostByUserId = async (userId) => {
  if (!isDatabaseEnabled) {
    // Demo mode: treat any authenticated user as having a host profile if needed.
    return { id: `demo-host-${userId}`, userId, name: "Demo Host", joined_year: 2024, superhost: false, demo: true };
  }

  try {
    const { rows } = await query(
      `select id, user_id, name, joined_year, superhost, created_at
       from public.hosts
       where user_id = $1::uuid
       limit 1`,
      [userId],
    );
    return rows[0] || null;
  } catch {
    throw new HttpError(503, "Host service is temporarily unavailable");
  }
};

export const ensureHostProfile = async ({ userId, name }) => {
  if (!isDatabaseEnabled) {
    return { id: `demo-host-${userId}`, userId, name: name || "Demo Host", joined_year: new Date().getFullYear(), superhost: false, demo: true };
  }

  const trimmedName = String(name || "").trim().slice(0, 120) || "Host";
  const joinedYear = new Date().getFullYear();

  try {
    const existing = await findHostByUserId(userId);
    if (existing) return existing;

    const client = await getClient();
    try {
      await client.query("begin");
      await client.query(
        `update public.profiles
         set role = case when role = 'admin' then role else 'host'::public.user_role end,
             full_name = case when coalesce(trim(full_name), '') = '' then $2 else full_name end
         where id = $1::uuid`,
        [userId, trimmedName],
      );

      const insert = await client.query(
        `insert into public.hosts (user_id, name, joined_year, superhost)
         values ($1::uuid, $2, $3, false)
         on conflict (user_id) where (user_id is not null) do update set name = excluded.name
         returning id, user_id, name, joined_year, superhost, created_at`,
        [userId, trimmedName, joinedYear],
      );

      await client.query("commit");
      return insert.rows[0];
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Host service is temporarily unavailable");
  }
};

const HOST_PROPERTY_SELECT = `
  select
    p.*,
    to_jsonb(h) as hosts,
    coalesce((
      select jsonb_agg(jsonb_build_object('url', pi.url, 'alt', pi.alt, 'position', pi.position) order by pi.position)
      from public.property_images pi where pi.property_id = p.id
    ), '[]'::jsonb) as property_images,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name, 'price', r.price, 'capacity', r.capacity, 'beds', r.beds, 'size', r.size, 'refundable', r.refundable) order by r.price, r.code)
      from public.rooms r where r.property_id = p.id
    ), '[]'::jsonb) as rooms,
    coalesce((
      select jsonb_agg(jsonb_build_object('amenity_id', pa.amenity_id, 'amenities', jsonb_build_object('id', a.id, 'label', a.label)) order by a.label)
      from public.property_amenities pa join public.amenities a on a.id = pa.amenity_id where pa.property_id = p.id
    ), '[]'::jsonb) as property_amenities,
    coalesce((
      select jsonb_agg(jsonb_build_object('guest_name', pr.guest_name, 'reviewed_on', pr.reviewed_on, 'rating', pr.rating, 'quote', pr.quote) order by pr.reviewed_on desc, pr.created_at desc)
      from public.property_reviews pr where pr.property_id = p.id
    ), '[]'::jsonb) as property_reviews
  from public.properties p
  join public.hosts h on h.id = p.host_id
`;

export const listHostListings = async (auth) => {
  if (!isDatabaseEnabled) {
    return { data: DEMO_HOST_LISTINGS, sampleData: true };
  }

  const host = await findHostByUserId(auth.userId);
  if (!host) return { data: [], sampleData: false };

  try {
    const { rows } = await query(
      `${HOST_PROPERTY_SELECT}
       where p.host_id = $1::uuid
       order by p.created_at desc, p.name asc`,
      [host.id],
    );
    const data = rows.map(toListingResponse);
    return { data, sampleData: false };
  } catch {
    throw new HttpError(503, "Host listings are temporarily unavailable");
  }
};

export const listHostBookings = async (auth) => {
  if (!isDatabaseEnabled) {
    return { data: DEMO_HOST_BOOKINGS, sampleData: true };
  }

  const host = await findHostByUserId(auth.userId);
  if (!host) return { data: [], sampleData: false };

  try {
    const { rows } = await query(
      `select b.reference, b.check_in, b.check_out, b.status, b.total, b.payment_status,
              b.guest_first_name, b.guest_last_name,
              p.name as property_name,
              r.name as room_name
       from public.bookings b
       join public.properties p on p.id = b.property_id
       join public.rooms r on r.id = b.room_id
       where p.host_id = $1::uuid
       order by b.created_at desc
       limit 100`,
      [host.id],
    );

    const data = rows.map((row) => ({
      guest: `${row.guest_first_name || ""} ${row.guest_last_name || ""}`.trim() || "Guest",
      property: row.property_name,
      unit: row.room_name,
      dates: `${String(row.check_in).slice(0, 10)} to ${String(row.check_out).slice(0, 10)}`,
      status: row.payment_status === "paid" ? "Confirmed" : row.status === "cancelled" ? "Cancelled" : row.status === "completed" ? "Completed" : "Pending",
      gross: row.total,
      reference: row.reference,
      paymentStatus: row.payment_status,
      bookingStatus: row.status,
    }));
    return { data, sampleData: false };
  } catch {
    throw new HttpError(503, "Host bookings are temporarily unavailable");
  }
};

export const getHostDashboard = async (auth) => {
  const host = await findHostByUserId(auth.userId);
  const listings = await listHostListings(auth);
  const hostBookings = await listHostBookings(auth);

  const gross = hostBookings.data.reduce((sum, b) => sum + (Number(b.gross) || 0), 0);
  const paidGross = hostBookings.data
    .filter((b) => b.paymentStatus === "paid" || b.status === "Confirmed" || b.status === "Completed")
    .reduce((sum, b) => sum + (Number(b.gross) || 0), 0);
  const pending = hostBookings.data
    .filter((b) => b.status === "Pending")
    .reduce((sum, b) => sum + (Number(b.gross) || 0), 0);
  const upcoming = hostBookings.data.filter((b) => b.status === "Confirmed" || b.status === "Pending").length;

  return {
    data: {
      host: host ? {
        id: host.id,
        name: host.name,
        joinedYear: host.joined_year,
        superhost: Boolean(host.superhost),
      } : null,
      listings: listings.data,
      bookings: hostBookings.data,
      stats: {
        listingsCount: listings.data.length,
        upcomingBookings: upcoming,
        gross,
        net: Math.round((paidGross || gross) * 0.9),
        pending,
        occupancyRate: listings.data.length ? 72 : 0,
      },
    },
    sampleData: Boolean(listings.sampleData || hostBookings.sampleData),
  };
};



const assertListingOwnership = async (auth, listingId) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Host listing service is unavailable in sample mode");
  }
  const host = await requireHost(auth);
  const row = await getOwnedPropertyRow(host.id, listingId);
  if (!row) throw new HttpError(404, "Listing not found");
  return { host, row };
};

export const createHostListing = async (auth, payload) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Host listing creation is unavailable in sample mode");
  }
  const host = await requireHost(auth);

  const name = String(payload.name || "").trim();
  const type = String(payload.type || "apartment").trim().toLowerCase();
  const area = String(payload.area || "Jos").trim();
  const basePrice = Math.max(5000, Math.round(Number(payload.price) || 0));
  const weekendPrice = Math.max(basePrice, Math.round(Number(payload.weekendPrice) || basePrice));
  const description = String(payload.description || "Host-submitted listing pending verification.").trim() || "Host-submitted listing pending verification.";
  const summary = description.slice(0, 220) || "Host listing";
  const address = String(payload.address || `${area}, Jos, Plateau State`).trim() || `${area}, Jos, Plateau State`;
  const slugBase = slugify(name);
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 6)}`;

  const client = await getClient();
  try {
    await client.query("begin");
    const verificationStatus = payload.submitForReview === false ? "draft" : "pending_review";
    const prop = await client.query(
      `insert into public.properties (
         host_id, slug, name, type, area, address, price, weekend_price, cleaning_fee,
         rating, review_count, verified, free_cancellation, distance_km, badge, max_guests,
         summary, description, house_rules, is_published, verification_status, submitted_for_verification_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, $7::int, $8::int, 0,
         0, 0, false, false, 0, null, 2,
         $9, $10, $11::text[], false, $12, case when $12 = 'pending_review' then now() else null end
       )
       returning *`,
      [host.id, slug, name, type, area, address, basePrice, weekendPrice, summary, description, ["Valid ID required at check-in"], verificationStatus],
    );
    const propertyId = prop.rows[0].id;

    await client.query(
      `insert into public.rooms (property_id, code, name, price, weekend_price, capacity, beds, size, refundable)
       values ($1::uuid, 'standard', 'Standard Room', $2::int, $3::int, 2, '1 bed', 'Standard', true)`,
      [propertyId, basePrice, weekendPrice],
    );

    if (Array.isArray(payload.images) && payload.images.length) {
      await replaceListingImages(client, propertyId, payload.images);
    }

    if (Array.isArray(payload.documents) && payload.documents.length) {
      await insertListingDocuments(client, host.id, propertyId, payload.documents);
    } else {
      // Backward-compatible metadata-only records when client hasn't uploaded files yet.
      const photoCount = Math.max(0, Number(payload.photoCount) || 0);
      const docs = [];
      if (photoCount > 0 && !(Array.isArray(payload.images) && payload.images.length)) {
        docs.push(["property_photo", `Declared ${photoCount} photo(s)`]);
      }
      if (payload.hasIdDocument) docs.push(["government_id", String(payload.idDocumentName || "ID document")]);
      if (payload.hasOwnershipDocument) docs.push(["proof_of_ownership", String(payload.ownershipDocumentName || "Ownership document")]);
      for (const [docType, fileName] of docs) {
        await client.query(
          `insert into public.host_verification_documents (host_id, property_id, document_type, file_name, status)
           values ($1::uuid, $2::uuid, $3, $4, 'submitted')`,
          [host.id, propertyId, docType, fileName.slice(0, 200)],
        );
      }
    }

    await client.query("commit");

    const row = await getOwnedPropertyRow(host.id, propertyId);
    return { data: toListingResponse(row), sampleData: false };
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Could not create listing");
  } finally {
    client.release();
  }
};

export const updateHostListing = async (auth, listingId, payload) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Host listing service is unavailable in sample mode");
  }
  const { host, row: existing } = await assertListingOwnership(auth, listingId);

  const updates = [];
  const values = [listingId, host.id];
  const push = (fragment, value) => {
    values.push(value);
    updates.push(`${fragment} $${values.length}`);
  };

  if (payload.name != null) push("name =", String(payload.name).trim());
  if (payload.type != null) push("type =", String(payload.type).trim().toLowerCase());
  if (payload.area != null) push("area =", String(payload.area).trim());
  if (payload.address != null) push("address =", String(payload.address).trim());
  if (payload.description != null) {
    const desc = String(payload.description).trim();
    push("description =", desc || "Host listing");
    push("summary =", (desc || String(existing.summary || "Host listing")).slice(0, 220));
  }
  if (payload.price != null) {
    const base = Math.max(5000, Math.round(Number(payload.price) || 0));
    push("price =", base);
  }
  if (payload.weekendPrice != null) {
    const weekend = Math.max(0, Math.round(Number(payload.weekendPrice) || 0));
    push("weekend_price =", weekend);
  }

  const client = await getClient();
  try {
    await client.query("begin");

    if (updates.length) {
      await client.query(
        `update public.properties
         set ${updates.join(", ")}, updated_at = now()
         where id = $1::uuid and host_id = $2::uuid`,
        values,
      );
      // Keep primary room roughly in sync if base/weekend prices were changed.
      if (payload.price != null || payload.weekendPrice != null) {
        const nextBase = payload.price != null ? Math.max(5000, Math.round(Number(payload.price) || 0)) : Number(existing.price || 0);
        const nextWeekend = payload.weekendPrice != null ? Math.max(nextBase, Math.round(Number(payload.weekendPrice) || nextBase)) : Math.max(nextBase, Number(existing.weekend_price || nextBase));
        await client.query(
          `update public.rooms
           set price = case when code = 'standard' then $2::int else price end,
               weekend_price = case when code = 'standard' then $3::int else coalesce(weekend_price, price) end,
               updated_at = now()
           where property_id = $1::uuid`,
          [listingId, nextBase, nextWeekend],
        );
      }
    }

    if (Array.isArray(payload.images)) {
      await replaceListingImages(client, listingId, payload.images);
    }
    if (Array.isArray(payload.documents) && payload.documents.length) {
      await insertListingDocuments(client, host.id, listingId, payload.documents);
    }

    await client.query("commit");
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Could not update listing");
  } finally {
    client.release();
  }

  const row = await getOwnedPropertyRow(host.id, listingId);
  if (!row) throw new HttpError(404, "Listing not found");
  return { data: toListingResponse(row), sampleData: false };
};

export const submitHostListingForReview = async (auth, listingId) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Host listing service is unavailable in sample mode");
  }
  const { host } = await assertListingOwnership(auth, listingId);

  await query(
    `update public.properties
     set verification_status = case
           when is_published then verification_status
           else 'pending_review'
         end,
         submitted_for_verification_at = case when is_published then submitted_for_verification_at else now() end,
         updated_at = now()
     where id = $1::uuid and host_id = $2::uuid`,
    [listingId, host.id],
  );

  const row = await getOwnedPropertyRow(host.id, listingId);
  if (!row) throw new HttpError(404, "Listing not found");
  return { data: toListingResponse(row), sampleData: false };
};

export const updateHostListingPricing = async (auth, listingId, payload) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Host listing service is unavailable in sample mode");
  }
  const { host } = await assertListingOwnership(auth, listingId);
  const basePrice = Math.max(1000, Math.round(Number(payload.basePrice ?? payload.price) || 0));
  const weekendPrice = Math.max(basePrice, Math.round(Number(payload.weekendPrice) || basePrice));

  const client = await getClient();
  try {
    await client.query("begin");
    await client.query(
      `update public.properties
       set price = $2::int, weekend_price = $3::int, updated_at = now()
       where id = $1::uuid and host_id = $4::uuid`,
      [listingId, basePrice, weekendPrice, host.id],
    );
    await client.query(
      `update public.rooms
       set price = $2::int, weekend_price = $3::int, updated_at = now()
       where property_id = $1::uuid`,
      [listingId, basePrice, weekendPrice],
    );
    await client.query("commit");
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Could not update pricing");
  } finally {
    client.release();
  }

  const row = await getOwnedPropertyRow(host.id, listingId);
  const mapped = mapPropertyRow(row);
  return { data: { id: mapped.id, slug: mapped.slug, price: mapped.price, weekendPrice: row.weekend_price ?? mapped.price }, sampleData: false };
};

export const listHostListingBlocks = async (auth, listingId) => {
  if (!isDatabaseEnabled) {
    return { data: [], sampleData: true };
  }
  await assertListingOwnership(auth, listingId);
  const { rows } = await query(
    `select id, property_id, room_id, start_date, end_date, reason, created_at
     from public.property_availability_blocks
     where property_id = $1::uuid
     order by start_date asc, created_at asc`,
    [listingId],
  );
  return {
    data: rows.map((r) => ({
      id: r.id,
      propertyId: r.property_id,
      roomId: r.room_id,
      startDate: toIsoDate(r.start_date),
      endDate: toIsoDate(r.end_date),
      reason: r.reason || null,
    })),
    sampleData: false,
  };
};

export const createHostListingBlock = async (auth, listingId, payload) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Host listing service is unavailable in sample mode");
  }
  await assertListingOwnership(auth, listingId);
  const startDate = toIsoDate(payload.startDate);
  const endDate = toIsoDate(payload.endDate || payload.startDate);
  if (!startDate) throw new HttpError(400, "startDate is required");
  const normalizedEnd = endDate && endDate > startDate ? endDate : (() => {
    const d = new Date(`${startDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const { rows } = await query(
    `insert into public.property_availability_blocks (property_id, room_id, start_date, end_date, reason, created_by)
     values ($1::uuid, $2::uuid, $3::date, $4::date, $5, $6::uuid)
     returning id, property_id, room_id, start_date, end_date, reason`,
    [listingId, payload.roomId || null, startDate, normalizedEnd, payload.reason || null, auth.userId || null],
  );
  const r = rows[0];
  return {
    data: { id: r.id, propertyId: r.property_id, roomId: r.room_id, startDate: toIsoDate(r.start_date), endDate: toIsoDate(r.end_date), reason: r.reason || null },
    sampleData: false,
  };
};

export const deleteHostListingBlock = async (auth, listingId, blockId) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Host listing service is unavailable in sample mode");
  }
  await assertListingOwnership(auth, listingId);
  const result = await query(
    `delete from public.property_availability_blocks where id = $1::uuid and property_id = $2::uuid`,
    [blockId, listingId],
  );
  if (!result.rowCount) throw new HttpError(404, "Block not found");
  return { ok: true };
};

const ADMIN_LISTING_SELECT = `
  select
    p.id, p.slug, p.name, p.type, p.area, p.address, p.price, p.weekend_price, p.summary, p.description,
    p.verified, p.is_published, p.verification_status, p.submitted_for_verification_at, p.verified_at,
    p.verification_notes, p.created_at, p.updated_at,
    h.id as host_id, h.name as host_record_name,
    pr.full_name as host_name, pr.email as host_email,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'documentType', d.document_type,
        'fileName', d.file_name,
        'fileUrl', d.file_url,
        'mimeType', d.mime_type,
        'status', d.status,
        'notes', d.notes,
        'submittedAt', d.submitted_at
      ) order by d.submitted_at desc, d.created_at desc)
      from public.host_verification_documents d
      where d.property_id = p.id
    ), '[]'::jsonb) as verification_documents,
    coalesce((
      select jsonb_agg(jsonb_build_object('url', pi.url, 'alt', pi.alt, 'position', pi.position) order by pi.position)
      from public.property_images pi
      where pi.property_id = p.id
    ), '[]'::jsonb) as property_images
  from public.properties p
  join public.hosts h on h.id = p.host_id
  join public.profiles pr on pr.id = h.user_id
`;

const toAdminListingResponse = (row) => {
  const images = [...(row.property_images || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((img) => img.url).filter(Boolean);
  const verificationStatus = row.verification_status || (row.verified ? "verified" : row.is_published ? "verified" : "draft");
  const status = row.is_published
    ? "Live"
    : verificationStatus === "pending_review"
      ? "In review"
      : verificationStatus === "rejected"
        ? "Rejected"
        : verificationStatus === "suspended"
          ? "Suspended"
          : "Draft";
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    area: row.area,
    address: row.address,
    price: row.price,
    weekendPrice: row.weekend_price ?? row.price,
    description: row.description,
    summary: row.summary,
    status,
    verificationStatus,
    isPublished: Boolean(row.is_published),
    verified: Boolean(row.verified),
    submittedForVerificationAt: row.submitted_for_verification_at,
    verifiedAt: row.verified_at,
    verificationNotes: row.verification_notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photoCount: images.length,
    images,
    host: {
      id: row.host_id,
      name: row.host_name,
      email: row.host_email,
      phone: row.host_phone || null,
      businessName: row.host_record_name || null,
    },
    documents: Array.isArray(row.verification_documents) ? row.verification_documents : [],
  };
};

export const listAdminReviewListings = async ({ status, limit = 50 } = {}) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Admin review service is unavailable in sample mode");
  }

  const params = [];
  let where = "where 1=1";
  if (status) {
    params.push(String(status));
    where += ` and p.verification_status = $${params.length}`;
  } else {
    where += ` and p.verification_status in ('pending_review', 'rejected', 'draft', 'suspended', 'verified')`;
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const limitParam = `$${params.length}`;

  const { rows } = await query(
    `${ADMIN_LISTING_SELECT}
     ${where}
     order by
       case when p.verification_status = 'pending_review' then 0 else 1 end,
       p.submitted_for_verification_at desc nulls last,
       p.updated_at desc
     limit ${limitParam}`,
    params,
  );

  return { data: rows.map(toAdminListingResponse), sampleData: false };
};

export const reviewHostListing = async ({ listingId, action, notes, reviewerUserId }) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Admin review service is unavailable in sample mode");
  }

  const normalizedAction = String(action || "").toLowerCase();
  if (!["approve", "reject", "suspend"].includes(normalizedAction)) {
    throw new HttpError(400, "Invalid review action");
  }

  const { rows: existingRows } = await query(
    `${ADMIN_LISTING_SELECT} where p.id = $1::uuid limit 1`,
    [listingId],
  );
  const existing = existingRows[0];
  if (!existing) throw new HttpError(404, "Listing not found");

  const cleanNotes = notes ? String(notes).trim().slice(0, 2000) : null;
  let verificationStatus = "pending_review";
  let verified = false;
  let isPublished = false;
  let verifiedAt = null;

  if (normalizedAction === "approve") {
    verificationStatus = "verified";
    verified = true;
    isPublished = true;
    verifiedAt = new Date().toISOString();
  } else if (normalizedAction === "reject") {
    verificationStatus = "rejected";
  } else if (normalizedAction === "suspend") {
    verificationStatus = "suspended";
  }

  const { rows } = await query(
    `update public.properties
     set verification_status = $2,
         verified = $3,
         is_published = $4,
         verified_at = $5::timestamptz,
         verification_notes = $6,
         updated_at = now()
     where id = $1::uuid
     returning id`,
    [listingId, verificationStatus, verified, isPublished, verifiedAt, cleanNotes],
  );
  if (!rows[0]) throw new HttpError(404, "Listing not found");

  // Best-effort document status sync for audit clarity.
  try {
    const docStatus = normalizedAction === "approve" ? "approved" : normalizedAction === "reject" ? "rejected" : "submitted";
    await query(
      `update public.host_verification_documents
       set status = $2, reviewed_at = now(), notes = coalesce($3, notes), updated_at = now()
       where property_id = $1::uuid and status in ('submitted', 'pending_review')`,
      [listingId, docStatus, cleanNotes],
    );
  } catch {}

  const { rows: refreshedRows } = await query(
    `${ADMIN_LISTING_SELECT} where p.id = $1::uuid limit 1`,
    [listingId],
  );
  const refreshed = refreshedRows[0];
  return {
    data: toAdminListingResponse(refreshed),
    sampleData: false,
    meta: {
      action: normalizedAction,
      hostEmail: refreshed.host_email,
      hostName: refreshed.host_name,
      listingName: refreshed.name,
    },
  };
};

