import { useState, useEffect, useCallback } from "react";
import { Globe, Building2, Eye, Loader2, Check, X, Search } from "lucide-react";
import { tokenStorage } from "@/lib/tokenStorage";

interface Organization {
  id: number;
  name: string;
  slug: string;
}

interface SharedAssessment {
  id: number;
  title: string;
  is_global: boolean;
  organization_id: number | null;
  organization_name: string | null;
  visible_to_organizations: { id: number; name: string }[];
  created_at: string;
}

interface SharedTechnology {
  id: string;
  name: string;
  category: string | null;
  is_global: boolean;
  organization_id: number | null;
  visible_to_organizations: { id: number; name: string }[];
}

type ContentType = "assessments" | "technologies";

const SharedContentManagement = () => {
  const [activeTab, setActiveTab] = useState<ContentType>("assessments");
  const [assessments, setAssessments] = useState<SharedAssessment[]>([]);
  const [technologies, setTechnologies] = useState<SharedTechnology[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | number | null>(null);
  const [search, setSearch] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  const headers = useCallback(() => {
    const token = tokenStorage.getAccessToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assessRes, techRes, orgRes] = await Promise.all([
        fetch("/v1/api/tenancy/admin/assessments/", { headers: headers() }),
        fetch("/v1/api/tenancy/admin/technologies/", { headers: headers() }),
        fetch("/v1/api/tenancy/admin/organizations/", { headers: headers() }),
      ]);

      if (assessRes.ok) setAssessments(await assessRes.json());
      if (techRes.ok) setTechnologies(await techRes.json());
      if (orgRes.ok) setOrganizations(await orgRes.json());
    } catch {
      setError("Failed to load content data.");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateAssessmentVisibility = async (
    id: number,
    isGlobal: boolean,
    orgIds: number[]
  ) => {
    setSaving(id);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(
        `/v1/api/tenancy/admin/assessments/${id}/visibility/`,
        {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({
            is_global: isGlobal,
            visible_to_organization_ids: orgIds,
          }),
        }
      );
      if (res.ok) {
        setSuccessMsg("Assessment visibility updated.");
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Update failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(null);
    }
  };

  const updateTechnologyVisibility = async (
    id: string,
    isGlobal: boolean,
    orgIds: number[]
  ) => {
    setSaving(id);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(
        `/v1/api/tenancy/admin/technologies/${id}/visibility/`,
        {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({
            is_global: isGlobal,
            visible_to_organization_ids: orgIds,
          }),
        }
      );
      if (res.ok) {
        setSuccessMsg("Technology visibility updated.");
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Update failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(null);
    }
  };

  const toggleGlobal = (item: SharedAssessment | SharedTechnology) => {
    if ("title" in item) {
      updateAssessmentVisibility(
        item.id,
        !item.is_global,
        item.visible_to_organizations.map((o) => o.id)
      );
    } else {
      updateTechnologyVisibility(
        (item as SharedTechnology).id,
        !item.is_global,
        item.visible_to_organizations.map((o) => o.id)
      );
    }
  };

  const toggleOrgVisibility = (
    item: SharedAssessment | SharedTechnology,
    orgId: number
  ) => {
    const currentIds = item.visible_to_organizations.map((o) => o.id);
    const newIds = currentIds.includes(orgId)
      ? currentIds.filter((id) => id !== orgId)
      : [...currentIds, orgId];

    if ("title" in item) {
      updateAssessmentVisibility(item.id, item.is_global, newIds);
    } else {
      updateTechnologyVisibility(
        (item as SharedTechnology).id,
        item.is_global,
        newIds
      );
    }
  };

  const filteredAssessments = assessments.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTechnologies = technologies.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Shared Content Management
        </h1>
        <p className="text-slate-500 mt-1">
          Manage content visibility across organizations. Mark items as global or
          share with specific organizations.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
          <X className="w-4 h-4" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("assessments")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "assessments"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Assessments ({assessments.length})
        </button>
        <button
          onClick={() => setActiveTab("technologies")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "technologies"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Technologies ({technologies.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Content Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                {activeTab === "assessments" ? "Assessment" : "Technology"}
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                Owner Org
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                <div className="flex items-center justify-center gap-1">
                  <Globe className="w-3 h-3" /> Global
                </div>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                <div className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Shared With
                </div>
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeTab === "assessments" &&
              filteredAssessments.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">
                      {item.title}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {item.organization_name || "Platform"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleGlobal(item)}
                      disabled={saving === item.id}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-all ${
                        item.is_global
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {saving === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : item.is_global ? (
                        <><Check className="w-3 h-3 mr-1" /> Yes</>
                      ) : (
                        "No"
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.visible_to_organizations.map((org) => (
                        <span
                          key={org.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700"
                        >
                          {org.name}
                          <button
                            onClick={() => toggleOrgVisibility(item, org.id)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <OrgShareDropdown
                      organizations={organizations}
                      currentIds={item.visible_to_organizations.map(
                        (o) => o.id
                      )}
                      onToggle={(orgId) => toggleOrgVisibility(item, orgId)}
                    />
                  </td>
                </tr>
              ))}
            {activeTab === "technologies" &&
              filteredTechnologies.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">
                      {item.name}
                    </span>
                    {item.category && (
                      <span className="ml-2 text-xs text-slate-400">
                        ({item.category})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {item.organization_id || "Platform"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleGlobal(item)}
                      disabled={saving === item.id}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-all ${
                        item.is_global
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {saving === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : item.is_global ? (
                        <><Check className="w-3 h-3 mr-1" /> Yes</>
                      ) : (
                        "No"
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.visible_to_organizations.map((org) => (
                        <span
                          key={org.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700"
                        >
                          {org.name}
                          <button
                            onClick={() => toggleOrgVisibility(item, org.id)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <OrgShareDropdown
                      organizations={organizations}
                      currentIds={item.visible_to_organizations.map(
                        (o) => o.id
                      )}
                      onToggle={(orgId) => toggleOrgVisibility(item, orgId)}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {((activeTab === "assessments" && filteredAssessments.length === 0) ||
          (activeTab === "technologies" &&
            filteredTechnologies.length === 0)) && (
          <div className="text-center py-12 text-slate-400">
            <Eye className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No content found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Org Share Dropdown Component ───────────────────────────────────

const OrgShareDropdown = ({
  organizations,
  currentIds,
  onToggle,
}: {
  organizations: Organization[];
  currentIds: number[];
  onToggle: (orgId: number) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 transition-all"
      >
        + Share
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-2 min-w-[200px] max-h-[200px] overflow-y-auto">
            {organizations.map((org) => (
              <label
                key={org.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={currentIds.includes(org.id)}
                  onChange={() => {
                    onToggle(org.id);
                    setOpen(false);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="text-slate-700">{org.name}</span>
              </label>
            ))}
            {organizations.length === 0 && (
              <p className="text-xs text-slate-400 px-2 py-1">
                No organizations available.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SharedContentManagement;
