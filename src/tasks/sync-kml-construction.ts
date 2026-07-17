/**
 * sync-kml-construction.ts
 *
 * Imports the static Improve I-70 KC construction features into the JKC
 * `features` / `feature_geometries` tables.
 */

import { logger } from "../lib/logger.js";
import type { Env } from "../types.js";

interface KMLFeature {
  id: string;
  name: string;
  description: string;
  geom: string;
}

const FEATURES: KMLFeature[] = [
  {
    id: "kml:i70:improve_i_70_project_area",
    name: "Improve I-70 Project Area",
    description: "Phase: Project Area. 2025-2028",
    geom: '{"type": "Polygon", "coordinates": [[[-94.567052, 39.0989513], [-94.5672698, 39.0937542], [-94.5528502, 39.093255], [-94.5480866, 39.0934878], [-94.5459409, 39.0889912], [-94.5461336, 39.0844725], [-94.5365635, 39.0693474], [-94.5268217, 39.0690475], [-94.5143091, 39.065572], [-94.5055757, 39.0614734], [-94.501177, 39.0683875], [-94.5089876, 39.0719359], [-94.5258533, 39.0755675], [-94.5316039, 39.0757674], [-94.5358096, 39.0818306], [-94.5358096, 39.0894921], [-94.5432549, 39.0993179], [-94.5541345, 39.0986849], [-94.567052, 39.0989513]]]}',
  },
  {
    id: "kml:i70:benton_curve___reconstruction",
    name: "Benton Curve - Reconstruction",
    description: "Phase: I-70 Improvements Overview. 2025 - 2028",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5481664, 39.097371], [-94.5481798, 39.0966258], [-94.5480323, 39.0966175], [-94.5474315, 39.0965509], [-94.5466805, 39.096376], [-94.5461011, 39.0961429], [-94.545554, 39.0958681], [-94.5451087, 39.0955808], [-94.54476, 39.0952353], [-94.54476, 39.0948856], [-94.5448459, 39.0940362], [-94.5448888, 39.0930953], [-94.5425821, 39.093037], [-94.5424855, 39.0945691], [-94.5424962, 39.0948273], [-94.5426894, 39.0952936], [-94.5429683, 39.0957682], [-94.5433331, 39.0963177], [-94.5437837, 39.0967257], [-94.544245, 39.0970338], [-94.5446849, 39.097242], [-94.5481664, 39.097371]]]}',
  },
  {
    id: "kml:i70:reconstruct_jackson_curve",
    name: "Reconstruct Jackson Curve",
    description: "Phase: I-70 Improvements Overview. 2025-2028",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5374462, 39.0765079], [-94.537017, 39.0757666], [-94.5367166, 39.0750503], [-94.536427, 39.0745673], [-94.5363626, 39.0740259], [-94.536384, 39.0735928], [-94.5364055, 39.0731346], [-94.5364377, 39.0726099], [-94.5352575, 39.07251], [-94.5341632, 39.0724516], [-94.5330474, 39.0725016], [-94.5318136, 39.072485], [-94.5308587, 39.0724933], [-94.5309016, 39.0731097], [-94.5316955, 39.073118], [-94.5323822, 39.0731263], [-94.533219, 39.0732513], [-94.5339164, 39.0735678], [-94.5344207, 39.0738926], [-94.5348391, 39.0743257], [-94.5352361, 39.0748838], [-94.5355257, 39.0753335], [-94.5359763, 39.0759499], [-94.5363913, 39.0764965], [-94.5374462, 39.0765079]]]}',
  },
  {
    id: "kml:i70:interstate_70",
    name: "Interstate 70",
    description: "Phase: I-70 Improvements Overview. 4th EB thru lane, additional EB auxiliary lanes, replace mainline bridges. FULL CLOSURE between Prospect Ave. & Van Brunt Blvd.: FEB-NOV 2027",
    geom: '{"type": "LineString", "coordinates": [[-94.5514481, 39.0964243], [-94.550508, 39.0967241], [-94.5495679, 39.0969489], [-94.5483663, 39.0970322], [-94.54636, 39.0967241], [-94.5444825, 39.095958], [-94.5436886, 39.0951337], [-94.5434096, 39.0942178], [-94.5433667, 39.0933268], [-94.5433452, 39.0924358], [-94.542562, 39.0908953], [-94.54187, 39.0896004], [-94.5413926, 39.0883055], [-94.5411965, 39.0871148], [-94.541172, 39.085924], [-94.5412364, 39.0832091], [-94.5406463, 39.0818682], [-94.5396271, 39.0804191], [-94.5391013, 39.0796279], [-94.5375028, 39.0774458], [-94.5359255, 39.0748805], [-94.5355447, 39.0740143], [-94.5348822, 39.0734313], [-94.5338227, 39.0729815], [-94.5316072, 39.0728066], [-94.5294131, 39.0727649], [-94.5276965, 39.0726899], [-94.5265593, 39.0724984], [-94.5230832, 39.0717987], [-94.5219888, 39.0715655], [-94.5210018, 39.0713489], [-94.517171, 39.0705618], [-94.5134153, 39.0697246], [-94.5110647, 39.0687665], [-94.5079729, 39.0673998]]}',
  },
  {
    id: "kml:i70:23rd_st_over_i_70___bridge_replacement",
    name: "23rd St. over I-70 - Bridge Replacement",
    description: "Phase: Phase 1 Construction (2025). 2025",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5419388, 39.0841428], [-94.5419389, 39.0838701], [-94.5406004, 39.0838316], [-94.5405924, 39.0841075], [-94.5419388, 39.0841428]]]}',
  },
  {
    id: "kml:i70:new_pedestrian_bridge_at_25th_st_over_i_70",
    name: "New Pedestrian Bridge at 25th St. over I-70",
    description: "Phase: Phase 1 Construction (2025). 2025",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5403156, 39.0805562], [-94.5401494, 39.0803105], [-94.539224, 39.0807269], [-94.5393849, 39.080958], [-94.5403156, 39.0805562]]]}',
  },
  {
    id: "kml:i70:cleveland_ave_over_i_70___bridge_replacement",
    name: "Cleveland Ave. over I-70 - Bridge Replacement",
    description: "Phase: Phase 2 Construction (2026). 2026",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5388918, 39.0785071], [-94.5387094, 39.0784905], [-94.5383875, 39.0779991], [-94.5382909, 39.0794024], [-94.5387845, 39.080152], [-94.5388918, 39.0785071]]]}',
  },
  {
    id: "kml:i70:27th_st_over_i_70___bridge_replacement",
    name: "27th St. over I-70 - Bridge Replacement",
    description: "Phase: Phase 2 Construction (2026). 2027",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5375583, 39.076864], [-94.5373893, 39.0763601], [-94.5362467, 39.0763184], [-94.5364317, 39.0768203], [-94.5375583, 39.076864]]]}',
  },
  {
    id: "kml:i70:lister_ave_over_i_70___bridge_replacement",
    name: "Lister Ave. over I-70 - Bridge Replacement",
    description: "Phase: Phase 2 Construction (2026). 2026",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5287199, 39.0732559], [-94.5287762, 39.072271], [-94.5282531, 39.0722501], [-94.5282183, 39.0732413], [-94.5287199, 39.0732559]]]}',
  },
  {
    id: "kml:i70:oakley_ave_pedestrian_bridge_over_i_70___replacement",
    name: "Oakley Ave. Pedestrian Bridge over I-70 - Replacement",
    description: "Phase: Phase 2 Construction (2026). 2026",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5184071, 39.0712334], [-94.5184392, 39.0702589], [-94.5181388, 39.0702526], [-94.518104, 39.0712314], [-94.5184071, 39.0712334]]]}',
  },
  {
    id: "kml:i70:eastern_limit_of_i_70_closure",
    name: "Eastern Limit of I-70 Closure",
    description: "Phase: Phase 3 Construction (2027). Feb. 2027 - Nov. 2027",
    geom: '{"type": "Point", "coordinates": [-94.5206343, 39.0712829]}',
  },
  {
    id: "kml:i70:i_70_over_the_paseo___bridge_rehabilitation",
    name: "I-70 over The Paseo - Bridge Rehabilitation",
    description: "Phase: Phase 3 Construction (2027). 2027",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5648982, 39.0964079], [-94.564917, 39.095848], [-94.5635571, 39.0958188], [-94.563541, 39.096385], [-94.5648982, 39.0964079]]]}',
  },
  {
    id: "kml:i70:i_70_over_woodland_ave___bridge_rehabilitation",
    name: "I-70 over Woodland Ave. - Bridge Rehabilitation",
    description: "Phase: Phase 3 Construction (2027). 2027",
    geom: '{"type": "Polygon", "coordinates": [[[-94.561192, 39.0963239], [-94.5612014, 39.0957608], [-94.560437, 39.0957421], [-94.5604142, 39.0963031], [-94.561192, 39.0963239]]]}',
  },
  {
    id: "kml:i70:i_70_over_brooklyn_ave___bridge_rehabilitation",
    name: "I-70 over Brooklyn Ave. - Bridge Rehabilitation",
    description: "Phase: Phase 3 Construction (2027). 2027",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5566933, 39.0962105], [-94.5567202, 39.0955818], [-94.5557197, 39.0955527], [-94.555717, 39.0961918], [-94.5566933, 39.0962105]]]}',
  },
  {
    id: "kml:i70:chestnut_ave_over_i_70___bridge_rehabilitation",
    name: "Chestnut Ave. over I-70 - Bridge Rehabilitation",
    description: "Phase: Phase 3 Construction (2027)",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5496018, 39.097408], [-94.5496232, 39.0965254], [-94.5490868, 39.0965046], [-94.5490868, 39.097383], [-94.5496018, 39.097408]]]}',
  },
  {
    id: "kml:i70:cypress_ave_pedestrian_bridge_over_i_70___removal",
    name: "Cypress Ave. Pedestrian Bridge over I-70 - Removal",
    description: "Phase: Phase 3 Construction (2027). 2027",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5307309, 39.0732236], [-94.5308624, 39.0732653], [-94.5309016, 39.0731097], [-94.5308356, 39.0722928], [-94.5307739, 39.0720076], [-94.5305244, 39.0720492], [-94.5306237, 39.0724261], [-94.5307309, 39.0732236]]]}',
  },
  {
    id: "kml:i70:western_limit_of_i_70_closure",
    name: "Western Limit of I-70 Closure",
    description: "Phase: Phase 3 Construction (2027). Feb. 2027 - Nov. 2027",
    geom: '{"type": "Point", "coordinates": [-94.5515618, 39.0963648]}',
  },
  {
    id: "kml:i70:i_70_over_us_40___bridge_rehabilitations",
    name: "I-70 over US-40 - Bridge Rehabilitations",
    description: "Phase: Phase 3 Construction (2027). 2027",
    geom: '{"type": "Polygon", "coordinates": [[[-94.5120192, 39.0689252], [-94.5120594, 39.0688773], [-94.5106352, 39.0682131], [-94.5102382, 39.0687503], [-94.5116947, 39.0693521], [-94.5120192, 39.0689252]]]}',
  },
];

function inferFeatureType(geom: { type: string }): "point" | "line" | "polygon" {
  switch (geom.type) {
    case "Point":
      return "point";
    case "Polygon":
      return "polygon";
    default:
      return "line";
  }
}

async function upsertGeometry(env: Env, featureId: string, geom: string) {
  const update = (await env.DB.prepare(
    "UPDATE feature_geometries SET public_geometry = ? WHERE feature_id = ?"
  )
    .bind(geom, featureId)
    .run()) as any;
  if ((update.meta?.changes ?? 0) === 0) {
    await env.DB.prepare(
      "INSERT INTO feature_geometries (feature_id, public_geometry) VALUES (?, ?)"
    )
      .bind(featureId, geom)
      .run();
  }
}

export async function syncKmlConstruction(env: Env): Promise<number> {
  logger.info("Starting KML construction sync", { features: FEATURES.length }, "SYNC");

  const featureStmt = env.DB.prepare(
    "INSERT OR IGNORE INTO features (id, slug, name, feature_type, category, status, visibility, officiality, public_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const sourceStmt = env.DB.prepare(
    "INSERT OR IGNORE INTO feature_sources (id, feature_id, source_url, source_note) VALUES (?, ?, ?, ?)"
  );

  let inserted = 0;
  for (const f of FEATURES) {
    try {
      const geomObj = JSON.parse(f.geom);
      const slugBase = f.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "i70";
      const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;
      const featureType = inferFeatureType(geomObj);

      await featureStmt
        .bind(
          f.id,
          slug,
          f.name,
          featureType,
          "Construction",
          "planned",
          "public",
          "planned",
          f.description
        )
        .run();
      await sourceStmt
        .bind(`${f.id}:source`, f.id, null, "Improve I-70 KC KML")
        .run();
      await upsertGeometry(env, f.id, f.geom);
      inserted++;
    } catch (e) {
      logger.error(`KML insert failed for ${f.id}`, e, "SYNC");
    }
  }

  logger.info("KML construction sync complete", { inserted }, "SYNC");
  return inserted;
}
