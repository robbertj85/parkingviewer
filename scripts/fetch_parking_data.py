#!/usr/bin/env python3
"""
Fetch parking occupancy data from the Dutch NPR/RDW SPDP v2 API.
Stores hourly snapshots for all public parking facilities in the Netherlands.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

SPDP_BASE = "https://npropendata.rdw.nl/parkingdata/v2"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "ParkingViewer/1.0 (https://github.com/parkingviewer)"
}

DATA_DIR = Path(__file__).parent.parent / "webapp" / "public" / "data"
CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"


def fetch_index():
    """Fetch the SPDP v2 index of all parking facilities."""
    cache_file = CACHE_DIR / "index.json"
    cache_file.parent.mkdir(parents=True, exist_ok=True)

    # Use cached index if less than 1 hour old
    if cache_file.exists():
        age = time.time() - cache_file.stat().st_mtime
        if age < 3600:
            print(f"Using cached index ({age:.0f}s old)")
            with open(cache_file) as f:
                return json.load(f)

    print("Fetching SPDP v2 index...")
    resp = requests.get(SPDP_BASE, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    data = resp.json()

    with open(cache_file, "w") as f:
        json.dump(data, f)

    print(f"Fetched {len(data.get('ParkingFacilities', []))} facilities")
    return data


def fetch_static(uuid):
    """Fetch static data for a facility."""
    resp = requests.get(f"{SPDP_BASE}/static/{uuid}", headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_dynamic(uuid):
    """Fetch dynamic (real-time) data for a facility."""
    resp = requests.get(f"{SPDP_BASE}/dynamic/{uuid}", headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_public_facilities(index_data):
    """Filter to only public facilities with dynamic data."""
    facilities = index_data.get("ParkingFacilities", [])
    return [
        f for f in facilities
        if not f.get("limitedAccess", True) and f.get("dynamicDataUrl")
    ]


def fetch_all_static(facilities):
    """Fetch static data for all facilities. Returns dict keyed by UUID."""
    cache_file = CACHE_DIR / "static_data.json"
    cache_file.parent.mkdir(parents=True, exist_ok=True)

    # Use cached static data if less than 24 hours old
    if cache_file.exists():
        age = time.time() - cache_file.stat().st_mtime
        if age < 86400:
            print(f"Using cached static data ({age / 3600:.1f}h old)")
            with open(cache_file) as f:
                return json.load(f)

    print(f"Fetching static data for {len(facilities)} facilities...")
    static_data = {}
    errors = 0

    def fetch_one(facility):
        uuid = facility["identifier"]
        try:
            time.sleep(0.05)  # 50ms delay between requests
            data = fetch_static(uuid)
            info = data.get("parkingFacilityInformation", {})

            # Try locationForDisplay first, then accessPoints
            loc = info.get("locationForDisplay", {})
            lat = loc.get("latitude")
            lng = loc.get("longitude")

            if not lat or not lng:
                # Fall back to first accessPoint location
                access_points = info.get("accessPoints", [])
                for ap in access_points:
                    for apl in ap.get("accessPointLocation", []):
                        if apl.get("latitude") and apl.get("longitude"):
                            lat = apl["latitude"]
                            lng = apl["longitude"]
                            break
                    if lat and lng:
                        break

            # Convert to float
            lat = float(lat) if lat else None
            lng = float(lng) if lng else None

            specs = info.get("specifications", [{}])
            spec = specs[0] if specs else {}
            capacity = spec.get("capacity")
            if capacity is not None:
                capacity = int(capacity)
            operator = info.get("operator", {})

            # Extract address from first accessPoint
            address = {}
            access_points = info.get("accessPoints", [])
            for ap in access_points:
                ap_addr = ap.get("accessPointAddress", {})
                if ap_addr.get("streetName"):
                    address = {
                        "street": ap_addr.get("streetName", ""),
                        "houseNumber": ap_addr.get("houseNumber", ""),
                        "zipcode": ap_addr.get("zipcode", ""),
                        "city": ap_addr.get("city", ""),
                        "province": ap_addr.get("province", ""),
                    }
                    break

            return uuid, {
                "uuid": uuid,
                "name": info.get("name", facility.get("name", "Unknown")),
                "latitude": lat,
                "longitude": lng,
                "capacity": capacity,
                "operator": operator.get("name", "Unknown"),
                "description": info.get("description", ""),
                "address": address,
                "minimumHeightInMeters": spec.get("minimumHeightInMeters"),
                "chargingPointCapacity": spec.get("chargingPointCapacity", 0),
                "disabledAccess": spec.get("disabledAccess", False),
                "usage": spec.get("usage", ""),
            }
        except Exception as e:
            return uuid, None

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_one, f): f for f in facilities}
        for future in as_completed(futures):
            uuid, result = future.result()
            if result:
                static_data[uuid] = result
            else:
                errors += 1

    print(f"Fetched static data: {len(static_data)} ok, {errors} errors")

    with open(cache_file, "w") as f:
        json.dump(static_data, f)

    return static_data


def fetch_all_dynamic(facilities):
    """Fetch dynamic data for all facilities. Returns dict keyed by UUID."""
    print(f"Fetching dynamic data for {len(facilities)} facilities...")
    dynamic_data = {}
    errors = 0

    def fetch_one(facility):
        uuid = facility["identifier"]
        try:
            time.sleep(0.05)
            data = fetch_dynamic(uuid)
            info = data.get("parkingFacilityDynamicInformation", {})
            status = info.get("facilityActualStatus", {})
            return uuid, {
                "vacantSpaces": status.get("vacantSpaces"),
                "parkingCapacity": status.get("parkingCapacity"),
                "open": status.get("open"),
                "full": status.get("full"),
                "lastUpdated": status.get("lastUpdated"),
            }
        except Exception as e:
            return uuid, None

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_one, f): f for f in facilities}
        for future in as_completed(futures):
            uuid, result = future.result()
            if result:
                dynamic_data[uuid] = result
            else:
                errors += 1

    print(f"Fetched dynamic data: {len(dynamic_data)} ok, {errors} errors")
    return dynamic_data


# PDOK uses official municipality names which differ from common names
_MUNICIPALITY_ALIASES = {
    "Den Haag": "'s-Gravenhage",
    "Den Bosch": "'s-Hertogenbosch",
}


def geocode_facility(name, operator=None):
    """Use PDOK geocoding to find coordinates for a facility by name.
    Builds a list of (query, fq_filter) pairs to try in order.
    operator can serve as a municipality hint (many municipal operators use their city name).
    """
    queries = []  # list of (query_string, municipality_filter_or_None)

    # Q-Park style: "AMSTERDAM-The Bank Rembrandtplein" → search address in city
    if "-" in name and name.split("-")[0].isupper():
        parts = name.split("-", 1)
        city = parts[0].title()
        address = parts[1]
        pdok_city = _MUNICIPALITY_ALIASES.get(city, city)
        queries.append((address, pdok_city))
        queries.append((f"{address} {city}", None))
        queries.append((city, None))

    # "(City)" style: "Garage Turfmarkt (Den Haag)" → search name in city
    if "(" in name and ")" in name:
        start = name.rindex("(") + 1
        end = name.rindex(")")
        city = name[start:end].strip()
        pdok_city = _MUNICIPALITY_ALIASES.get(city, city)
        before_paren = name[:name.rindex("(")].strip()
        queries.append((before_paren, pdok_city))
        queries.append((f"{before_paren} {city}", None))

    # Use operator as municipality hint (e.g. operator="Amsterdam" for "Garage Waterlooplein")
    if operator and operator not in ("Unknown",):
        pdok_op = _MUNICIPALITY_ALIASES.get(operator, operator)
        queries.append((name, pdok_op))
        queries.append((f"{name} {operator}", None))

    # Fallback: full name as-is
    queries.append((name, None))

    for query, city_filter in queries:
        try:
            params = {"q": query, "rows": 1, "fl": "centroide_ll,gemeentenaam"}
            if city_filter:
                params["fq"] = f"gemeentenaam:{city_filter}"
            resp = requests.get(
                "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free",
                params=params,
                timeout=10,
            )
            if resp.ok:
                docs = resp.json().get("response", {}).get("docs", [])
                if docs and docs[0].get("centroide_ll"):
                    point = docs[0]["centroide_ll"]  # "POINT(lng lat)"
                    coords = point.replace("POINT(", "").replace(")", "").split()
                    lng, lat = float(coords[0]), float(coords[1])
                    municipality = docs[0].get("gemeentenaam")
                    return lat, lng, municipality
        except Exception:
            pass
        time.sleep(0.05)

    return None, None, None


def extract_municipality(name):
    """Extract municipality name from facility name.
    Names are typically like 'Q-Park Beekstraat (Apeldoorn)' or 'P+R Amsterdam Arena'.
    """
    if "(" in name and ")" in name:
        start = name.rindex("(") + 1
        end = name.rindex(")")
        return name[start:end].strip()
    return None


def reverse_geocode_municipality(lat, lng):
    """Use PDOK reverse geocoding to find the municipality for coordinates."""
    try:
        resp = requests.get(
            f"https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lon={lng}&lat={lat}&rows=1&fl=gemeentenaam",
            timeout=10,
        )
        if resp.ok:
            docs = resp.json().get("response", {}).get("docs", [])
            if docs and docs[0].get("gemeentenaam"):
                return docs[0]["gemeentenaam"]
    except Exception:
        pass
    return None


# Cache for reverse geocoded municipalities to avoid duplicate API calls
_reverse_geocode_cache = {}


def resolve_municipality(name, description, lat, lng):
    """Resolve municipality from name/description, falling back to PDOK reverse geocoding."""
    # Try extracting from description first, then name
    for text in [description, name]:
        if text:
            result = extract_municipality(text)
            if result:
                return result

    # Fall back to PDOK reverse geocoding using coordinates
    if lat and lng:
        # Round to 3 decimals (~100m) for cache key to group nearby facilities
        cache_key = (round(lat, 3), round(lng, 3))
        if cache_key in _reverse_geocode_cache:
            return _reverse_geocode_cache[cache_key]

        time.sleep(0.05)  # Rate limit PDOK requests
        municipality = reverse_geocode_municipality(lat, lng)
        _reverse_geocode_cache[cache_key] = municipality or "Onbekend"
        if municipality:
            return municipality

    return "Onbekend"


def build_facilities_geojson(static_data, dynamic_data):
    """Build a GeoJSON FeatureCollection combining static and dynamic data."""
    features = []
    municipalities = {}

    geocoded_count = 0
    for uuid, static in static_data.items():
        lat = static.get("latitude")
        lng = static.get("longitude")
        geocoded_municipality = None

        # Geocode facilities missing coordinates
        if not lat or not lng:
            glat, glng, gmuni = geocode_facility(static.get("name", ""), static.get("operator"))
            if glat and glng:
                lat = glat
                lng = glng
                static["latitude"] = lat
                static["longitude"] = lng
                geocoded_municipality = gmuni
                geocoded_count += 1
                print(f"  Geocoded: {static.get('name')} → ({lat:.4f}, {lng:.4f})")
            else:
                print(f"  Skipped (no coords): {static.get('name')}")
                continue

        dynamic = dynamic_data.get(uuid, {})
        capacity = dynamic.get("parkingCapacity") or static.get("capacity")
        vacant = dynamic.get("vacantSpaces")
        municipality = geocoded_municipality or resolve_municipality(
            static["name"],
            static.get("description", ""),
            lat,
            lng,
        )

        try:
            capacity = int(capacity) if capacity is not None else None
        except (TypeError, ValueError):
            capacity = None
        try:
            vacant = int(vacant) if vacant is not None else None
        except (TypeError, ValueError):
            vacant = None

        occupancy_pct = None
        if capacity and vacant is not None and capacity > 0:
            occupancy_pct = round(((capacity - vacant) / capacity) * 100, 1)

        address = static.get("address", {})
        props = {
            "uuid": uuid,
            "name": static["name"],
            "municipality": municipality,
            "operator": static.get("operator", "Unknown"),
            "street": address.get("street", ""),
            "houseNumber": address.get("houseNumber", ""),
            "zipcode": address.get("zipcode", ""),
            "city": address.get("city", ""),
            "province": address.get("province", ""),
            "capacity": capacity,
            "vacantSpaces": vacant,
            "occupancyPercent": occupancy_pct,
            "open": dynamic.get("open"),
            "full": dynamic.get("full"),
            "lastUpdated": dynamic.get("lastUpdated"),
            "minimumHeightInMeters": static.get("minimumHeightInMeters"),
            "chargingPointCapacity": static.get("chargingPointCapacity", 0),
            "disabledAccess": static.get("disabledAccess", False),
            "usage": static.get("usage", ""),
        }

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [static["longitude"], static["latitude"]]
            },
            "properties": props,
        })

        # Track municipalities
        if municipality not in municipalities:
            municipalities[municipality] = []
        municipalities[municipality].append(uuid)

    if geocoded_count:
        print(f"Geocoded {geocoded_count} facilities that were missing coordinates")

    return {
        "type": "FeatureCollection",
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_facilities": len(features),
            "municipalities": sorted(municipalities.keys()),
            "municipality_counts": {k: len(v) for k, v in sorted(municipalities.items())},
        },
        "features": features,
    }, municipalities


def save_hourly_snapshot(dynamic_data, static_data):
    """Save an hourly snapshot to the daily file."""
    now = datetime.now(timezone.utc)
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")
    hour = now.strftime("%H")

    snapshot_dir = DATA_DIR / "snapshots" / year / month
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    snapshot_file = snapshot_dir / f"{day}.json"

    # Load existing daily file or create new
    if snapshot_file.exists():
        with open(snapshot_file) as f:
            daily = json.load(f)
    else:
        daily = {
            "date": now.strftime("%Y-%m-%d"),
            "snapshots": {}
        }

    # Build compact snapshot (only dynamic data)
    snapshot_facilities = {}
    for uuid, dyn in dynamic_data.items():
        if dyn.get("vacantSpaces") is not None or dyn.get("parkingCapacity") is not None:
            entry = {}
            if dyn.get("vacantSpaces") is not None:
                entry["v"] = dyn["vacantSpaces"]
            if dyn.get("parkingCapacity") is not None:
                entry["c"] = dyn["parkingCapacity"]
            if dyn.get("open") is not None:
                entry["o"] = dyn["open"]
            if dyn.get("full") is not None:
                entry["f"] = dyn["full"]
            snapshot_facilities[uuid] = entry

    daily["snapshots"][hour] = {
        "timestamp": now.isoformat(),
        "facility_count": len(snapshot_facilities),
        "facilities": snapshot_facilities,
    }

    with open(snapshot_file, "w") as f:
        json.dump(daily, f, separators=(",", ":"))

    print(f"Saved snapshot for {now.strftime('%Y-%m-%d')} hour {hour} ({len(snapshot_facilities)} facilities)")
    return snapshot_file


def generate_municipality_files(static_data, dynamic_data, municipalities):
    """Generate per-municipality data files for download."""
    muni_dir = DATA_DIR / "municipalities"
    muni_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    generated = []

    for muni_name, uuids in municipalities.items():
        safe_name = muni_name.lower().replace(" ", "-").replace("/", "-")
        if safe_name == "onbekend":
            continue

        facilities = []
        for uuid in uuids:
            static = static_data.get(uuid, {})
            dynamic = dynamic_data.get(uuid, {})
            capacity = dynamic.get("parkingCapacity") or static.get("capacity")
            vacant = dynamic.get("vacantSpaces")
            try:
                capacity = int(capacity) if capacity is not None else None
            except (TypeError, ValueError):
                capacity = None
            try:
                vacant = int(vacant) if vacant is not None else None
            except (TypeError, ValueError):
                vacant = None
            occupancy_pct = None
            if capacity and vacant is not None and capacity > 0:
                occupancy_pct = round(((capacity - vacant) / capacity) * 100, 1)

            address = static.get("address", {})
            facilities.append({
                "uuid": uuid,
                "name": static.get("name", "Unknown"),
                "operator": static.get("operator", "Unknown"),
                "street": address.get("street", ""),
                "houseNumber": address.get("houseNumber", ""),
                "zipcode": address.get("zipcode", ""),
                "city": address.get("city", ""),
                "province": address.get("province", ""),
                "latitude": static.get("latitude"),
                "longitude": static.get("longitude"),
                "capacity": capacity,
                "vacantSpaces": vacant,
                "occupancyPercent": occupancy_pct,
                "open": dynamic.get("open"),
                "full": dynamic.get("full"),
                "lastUpdated": dynamic.get("lastUpdated"),
                "minimumHeightInMeters": static.get("minimumHeightInMeters"),
                "chargingPointCapacity": static.get("chargingPointCapacity", 0),
                "disabledAccess": static.get("disabledAccess", False),
                "usage": static.get("usage", ""),
            })

        muni_data = {
            "municipality": muni_name,
            "generated_at": now.isoformat(),
            "facility_count": len(facilities),
            "facilities": facilities,
        }

        with open(muni_dir / f"{safe_name}.json", "w") as f:
            json.dump(muni_data, f, indent=2)

        generated.append(safe_name)

    # Generate index of all municipalities
    index = {
        "generated_at": now.isoformat(),
        "municipalities": [
            {
                "name": muni_name,
                "slug": muni_name.lower().replace(" ", "-").replace("/", "-"),
                "facility_count": len(uuids),
            }
            for muni_name, uuids in sorted(municipalities.items())
            if muni_name != "Onbekend"
        ]
    }
    with open(muni_dir / "index.json", "w") as f:
        json.dump(index, f, indent=2)

    print(f"Generated {len(generated)} municipality files")


def generate_summary(static_data, dynamic_data, municipalities):
    """Generate summary statistics."""
    total_capacity = 0
    total_vacant = 0
    total_open = 0
    total_full = 0
    operators = {}

    for uuid, static in static_data.items():
        dynamic = dynamic_data.get(uuid, {})
        capacity = dynamic.get("parkingCapacity") or static.get("capacity") or 0
        vacant = dynamic.get("vacantSpaces") or 0
        try:
            capacity = int(capacity)
            vacant = int(vacant)
        except (TypeError, ValueError):
            capacity = 0
            vacant = 0
        total_capacity += capacity
        total_vacant += vacant
        if dynamic.get("open"):
            total_open += 1
        if dynamic.get("full"):
            total_full += 1

        op = static.get("operator", "Unknown")
        if op not in operators:
            operators[op] = 0
        operators[op] += 1

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_facilities": len(static_data),
        "total_with_dynamic": len(dynamic_data),
        "total_capacity": total_capacity,
        "total_vacant": total_vacant,
        "total_occupied": total_capacity - total_vacant,
        "facilities_open": total_open,
        "facilities_full": total_full,
        "municipalities": len([m for m in municipalities if m != "Onbekend"]),
        "by_operator": dict(sorted(operators.items(), key=lambda x: -x[1])),
        "by_municipality": {
            k: len(v) for k, v in sorted(municipalities.items(), key=lambda x: -len(x[1]))
            if k != "Onbekend"
        },
    }


def main():
    """Main entry point."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1: Fetch index
    index = fetch_index()
    facilities = get_public_facilities(index)
    print(f"Found {len(facilities)} public facilities with dynamic data")

    if not facilities:
        print("No facilities found!")
        sys.exit(1)

    # Step 2: Fetch static data
    static_data = fetch_all_static(facilities)

    # Step 3: Fetch dynamic data
    dynamic_data = fetch_all_dynamic(facilities)

    # Step 4: Build GeoJSON
    geojson, municipalities = build_facilities_geojson(static_data, dynamic_data)

    # Save GeoJSON
    with open(DATA_DIR / "parking_facilities.geojson", "w") as f:
        json.dump(geojson, f)
    print(f"Saved GeoJSON with {len(geojson['features'])} features")

    # Step 5: Save hourly snapshot
    save_hourly_snapshot(dynamic_data, static_data)

    # Step 6: Generate municipality files
    generate_municipality_files(static_data, dynamic_data, municipalities)

    # Step 7: Generate summary
    summary = generate_summary(static_data, dynamic_data, municipalities)
    with open(DATA_DIR / "summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Summary: {summary['total_facilities']} facilities, {summary['municipalities']} municipalities")

    # Step 8: Save latest snapshot
    latest = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "facilities": {
            uuid: {
                **static_data.get(uuid, {}),
                **dynamic_data.get(uuid, {}),
            }
            for uuid in set(list(static_data.keys()) + list(dynamic_data.keys()))
        }
    }
    with open(DATA_DIR / "latest.json", "w") as f:
        json.dump(latest, f, separators=(",", ":"))

    print("Done!")


if __name__ == "__main__":
    main()
