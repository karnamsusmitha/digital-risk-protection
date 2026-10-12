import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export function useOverview(timeframe = '7d') {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resStats, resActivity] = await Promise.all([
        apiService.getOverviewStats(timeframe),
        apiService.getActivityLog()
      ]);
      setStats(resStats);
      setActivity(resActivity);
    } catch (err) {
      setError(err.message || 'Failed to fetch telemetry data');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, activity, loading, error, refetch: fetchData };
}

export function useBrandProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getBrandProfiles();
      setProfiles(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch brand profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  const addProfile = async (newProfile) => {
    try {
      const created = await apiService.createBrandProfile(newProfile);
      setProfiles((prev) => [created, ...prev]);
      return { success: true, data: created };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteProfile = async (id) => {
    try {
      await apiService.deleteBrandProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return { profiles, loading, error, addProfile, deleteProfile, refetch: fetchProfiles };
}

export function useSocialAlerts(platform = 'all') {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getSocialAlerts(platform);
      setAlerts(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch social alerts');
    } finally {
      setLoading(false);
    }
  }, [platform]);

  const updateStatus = async (id, newStatus) => {
    try {
      const updated = await apiService.updateSocialStatus(id, newStatus);
      setAlerts((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, loading, error, updateStatus, refetch: fetchAlerts };
}

export function useAppAlerts() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getAppAlerts();
      setApps(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch rogue mobile app telemetry');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = async (id, newStatus) => {
    try {
      const updated = await apiService.updateAppStatus(id, newStatus);
      setApps((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  return { apps, loading, error, updateStatus, refetch: fetchApps };
}

export function useFindings(filters = {}) {
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filtersKey = JSON.stringify(filters);

  const fetchFindings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getFindings(JSON.parse(filtersKey));
      setFindings(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch incident findings');
    } finally {
      setLoading(false);
    }
  }, [filtersKey]);

  const updateStatus = async (id, newStatus) => {
    try {
      const updated = await apiService.updateFindingStatus(id, newStatus);
      setFindings((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const triggerTakedown = async (id) => {
    try {
      const updated = await apiService.triggerTakedown(id);
      setFindings((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const batchUpdate = async (ids, newStatus) => {
    try {
      await apiService.batchUpdateStatus(ids, newStatus);
      setFindings((prev) =>
        prev.map((item) => (ids.includes(item.id) ? { ...item, status: newStatus } : item))
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  return {
    findings,
    loading,
    error,
    updateStatus,
    triggerTakedown,
    batchUpdate,
    refetch: fetchFindings
  };
}
