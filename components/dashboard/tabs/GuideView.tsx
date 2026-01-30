"use client";

import { useDashboard } from "../DashboardContext";
import {
  ROLE_LABELS,
  ROLE_HIERARCHY,
  type UserRoleType,
} from "@/lib/auth/roles";

// ── Guide section definitions (Kinyarwanda) ──────────────────────

interface GuideSection {
  title: string;
  forRoles: UserRoleType[];
  blocks: { heading?: string; steps: string[] }[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  // ── Shared: Getting Started ────────────────────────────────────
  {
    title: "Gutangira — Kwinjira mu sisitemu",
    forRoles: ["FARM_CLERK", "FARM_MANAGER"],
    blocks: [
      {
        steps: [
          "Injira ukoresheje izina n'ijambo ryibanga ryawe.",
          "Koresha urutonde ruri ibumoso kugira ngo ujye ku bice bitandukanye.",
          "Ahitwa 'Week Selector' hejuru y'urupapuro rugufasha guhitamo icyumweru.",
        ],
      },
    ],
  },

  // ── Farm Clerk: Labor Logs (detailed) ──────────────────────────
  {
    title: "Kwandika Amakuru y'Abakozi (Labor Logs)",
    forRoles: ["FARM_CLERK", "FARM_MANAGER"],
    blocks: [
      {
        heading: "Intambwe ya 1 — Hitamo ubworozi",
        steps: [
          "Jya kuri 'Operations' ibumoso, hanyuma ukande 'Labor Logs' hejuru.",
          "Ubona amakarita y'ubworozi bwose. Buri karita igaragaza: izina ry'ubworozi, ubuso (Ha), umubare w'ibiciro, n'ingengo y'imari y'icyumweru.",
          "Kanda ku karita y'ubworozi ushaka kwandikira.",
        ],
      },
      {
        heading: "Intambwe ya 2 — Hitamo icyiciro (Phase)",
        steps: [
          "Ubona imbonerahamwe y'ibiciro byose by'ubworozi wahisemo.",
          "Buri murongo ugaragaza: Phase ID, igihingwa, itariki yo gutera, ubuso (Ha), n'icyumweru.",
          "Kanda buto ya 'Record' ku murongo w'icyiciro ushaka kwandikira.",
        ],
      },
      {
        heading: "Intambwe ya 3 — Uzuza ifishi",
        steps: [
          "Hitamo 'Task' mu idropdown — ni ibikorwa byateganijwe na SOP by'igihingwa.",
          "Hitamo itariki (Date) — igaragara ari iy'uyu munsi ariko urashobora kuyihindura.",
          "Andika umubare w'abakozi b'umunsi (Number of Casuals).",
          "Igiciro cyose kiboneka ku buryo bwikora bishingiye ku giciro cy'umukozi ku munsi.",
          "Wongereho icyitonderwa (Notes) niba bikenewe — si ngombwa.",
          "Kanda 'Save Record' kugira ngo ubike amakuru.",
        ],
      },
      {
        heading: "Nyuma yo kubika",
        steps: [
          "Ifishi isubira mu buryo bwera kugira ngo ubashe kwandika indi.",
          "Amakuru yanditswe agaragara mu mbonerahamwe hepfo ya 'Labor Log Records'.",
          "Niba wibeshye, ushobora gusiba umwandiko ukanda buto ya 'Delete'.",
        ],
      },
    ],
  },

  // ── Farm Clerk: Feeding Records (detailed) ─────────────────────
  {
    title: "Kwandika Amakuru yo Kugaburira (Feeding)",
    forRoles: ["FARM_CLERK", "FARM_MANAGER"],
    blocks: [
      {
        heading: "Intambwe ya 1 — Hitamo ubworozi",
        steps: [
          "Jya kuri 'Operations' hanyuma ukande 'Feeding' hejuru.",
          "Ubona amakarita y'ubworozi. Buri karita igaragaza: izina, ubuso, n'umubare w'ibiciro bikeneye kugaburirwa mu cyumweru.",
          "Igaragaza kandi compliance (%) — umubare w'amakuru yanditswe ugereranyije n'ayateganijwe.",
          "Kanda ku karita y'ubworozi ushaka.",
        ],
      },
      {
        heading: "Intambwe ya 2 — Hitamo icyiciro (Phase)",
        steps: [
          "Ubona imbonerahamwe y'ibiciro. Buri cyiciro kigaragaza ibicuruzwa byateganijwe na SOP.",
          "Kanda buto ya 'Record' ku cyiciro ushaka kwandikira.",
        ],
      },
      {
        heading: "Intambwe ya 3 — Uzuza ifishi",
        steps: [
          "Hitamo 'Product' mu idropdown — ni ibicuruzwa byateganijwe na SOP by'igihingwa.",
          "Hitamo itariki (Application Date) — igaragara ari iy'uyu munsi.",
          "Andika umubare nyawo wakoreshejwe (Actual Quantity).",
          "Rate/Ha iboneka ku buryo bwikora: umubare wawe ugabanywa n'ubuso bw'icyiciro.",
          "Wongereho icyitonderwa (Notes) niba bikenewe.",
          "Kanda 'Save Record'.",
        ],
      },
      {
        heading: "Nyuma yo kubika",
        steps: [
          "Ifishi isubira mu buryo bwera.",
          "Hepfo ubona imbonerahamwe ya 'Compliance Summary': igereranya umubare wateganijwe n'umubare nyawo.",
          "Itandukaniro (Variance %) rigaragara mu mabara: icyatsi = sawa (±5%), umuhondo = munsi (-5%), umutuku = hejuru (+5%).",
          "Niba wibeshye, ushobora gusiba umwandiko mu mbonerahamwe ya 'Feeding Records' ukanda 'Delete'.",
        ],
      },
    ],
  },

  // ── Farm Clerk: Harvest Logs (detailed) ────────────────────────
  {
    title: "Kwandika Amakuru y'Isarura (Harvesting)",
    forRoles: ["FARM_CLERK", "FARM_MANAGER"],
    blocks: [
      {
        heading: "Intambwe ya 1 — Hitamo ubworozi",
        steps: [
          "Jya kuri 'Operations' hanyuma ukande 'Harvesting' hejuru.",
          "Ubona amakarita y'ubworozi. Kanda ku karita y'ubworozi ushaka.",
        ],
      },
      {
        heading: "Intambwe ya 2 — Uzuza ifishi",
        steps: [
          "Hitamo 'Phase' mu idropdown — igaragaza igihingwa na Phase ID.",
          "Hitamo itariki (Date) — igaragara ari iy'uyu munsi.",
          "Wongereho icyitonderwa (Notes) niba bikenewe.",
          "Kanda 'Log Harvest' kugira ngo ubike.",
        ],
      },
      {
        heading: "Nyuma yo kubika",
        steps: [
          "Ifishi isubira mu buryo bwera.",
          "Amakuru yanditswe agaragara hepfo mu mbonerahamwe ya 'Recent Harvest Logs'.",
          "Ushobora gusiba umwandiko ukanda buto ya 'Delete'.",
        ],
      },
    ],
  },

  // ── Farm Manager: Production Planning ──────────────────────────
  {
    title: "Guteganya Umusaruro (IPP)",
    forRoles: ["FARM_MANAGER"],
    blocks: [
      {
        steps: [
          "Fungura 'IPP' mu gice cya 'Planning' ibumoso.",
          "Igishushanyo cy'ibyumweru 8 kigaragaza umusaruro uteganijwe (Tons) ku bworozi bwose.",
          "Kanda ku murongo w'igihingwa kugira ngo ubone uruhare rwa buri cyiciro.",
          "Hindura icyumweru muri 'Week Selector' kugira ngo ubone ibyateganijwe bitandukanye.",
        ],
      },
    ],
  },

  // ── Farm Manager: Schedule & Gantt ─────────────────────────────
  {
    title: "Gahunda na Gantt",
    forRoles: ["FARM_MANAGER"],
    blocks: [
      {
        steps: [
          "Fungura 'Labor Activities' cyangwa 'Nutri Activities' uhitemo ubworozi.",
          "Igishushanyo cya Gantt kigaragaza ibikorwa byose by'icyumweru.",
          "Kanda × ku gikorwa kugira ngo ukivane mu gahunda y'icyumweru.",
          "Koresha 'Add Activity' kugira ngo wongere ibikorwa bya SOP byo mu byumweru bitandukanye.",
          "Kanda 'Reset' kugira ngo usubize impinduka zose z'icyumweru.",
          "Impinduka zikora ku cyumweru kimwe gusa — gahunda isanzwe igaruka icyumweru gitaha.",
        ],
      },
    ],
  },

  // ── Farm Manager: Farm Settings ────────────────────────────────
  {
    title: "Igenamiterere ry'Ubworozi",
    forRoles: ["FARM_MANAGER"],
    blocks: [
      {
        steps: [
          "Jya kuri 'Farm Settings' ibumoso.",
          "Shyiraho igiciro cy'umukozi ku munsi (Labor Rate/Day) gisimbuza igiciro gisanzwe cya SOP.",
          "Impinduka zitangira gukora ako kanya ku bibarwa by'igiciro cy'abakozi.",
        ],
      },
    ],
  },

  // ── Farm Manager: PDF Download ─────────────────────────────────
  {
    title: "Gukuramo PDF",
    forRoles: ["FARM_MANAGER"],
    blocks: [
      {
        steps: [
          "Jya kuri 'Labor Activities' uhitemo ubworozi.",
          "Niba hari ibikorwa by'icyumweru, buto ya 'Download PDF' igaragara hejuru iburyo.",
          "Kanda 'Download PDF' kugira ngo ukuremo raporo ya PDF y'ibikorwa by'abakozi.",
        ],
      },
    ],
  },
];

// ── Component ────────────────────────────────────────────────────

export default function GuideView() {
  const { user } = useDashboard();

  const role = (user?.role ?? "AUDITOR") as UserRoleType;
  const roleLabel = ROLE_LABELS[role] ?? role;

  const visibleSections = GUIDE_SECTIONS.filter((s) =>
    s.forRoles.includes(role)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Ubuyobozi bw&apos;Sisitemu
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Uko wakoresha Souk FarmIQ — bishingiye ku ruhare rwawe
            </p>
          </div>
          <span className="inline-block bg-indigo-100 text-indigo-800 text-sm font-medium px-3 py-1 rounded-full">
            {roleLabel}
          </span>
        </div>
      </div>

      {visibleSections.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">
            Nta buyobozi buhari ku ruhare rwawe.
          </p>
        </div>
      ) : (
        visibleSections.map((section) => (
          <div
            key={section.title}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {section.title}
            </h3>
            <div className="space-y-4">
              {section.blocks.map((block, bi) => (
                <div key={bi}>
                  {block.heading && (
                    <p className="text-sm font-semibold text-gray-800 mb-2">
                      {block.heading}
                    </p>
                  )}
                  <ol className="list-decimal list-inside space-y-1.5 pl-1">
                    {block.steps.map((step, si) => (
                      <li
                        key={si}
                        className="text-sm text-gray-700 leading-relaxed"
                      >
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
