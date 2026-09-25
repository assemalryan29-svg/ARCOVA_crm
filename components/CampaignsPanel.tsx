import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { can, PERMISSIONS } from '../lib/permissions';

const card = {
  background: '#3f321f',
  border: '1px solid #d9c5a4',
  borderRadius: 10,
  padding: '0.85rem'
};

const money = (value) => Number(value || 0).toLocaleString('ar-EG');

export default function CampaignsPanel({ userRole = 'sales', campaigns = [] }) {
  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const canSeeDeals = can(userRole, PERMISSIONS.DEALS_VIEW);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const queries = [
        supabase.from('leads').select('id,campaign_id,status,lead_source,created_at'),
        supabase.from('opportunities').select('id,lead_id,stage,status,estimated_value')
      ];

      if (canSeeDeals) {
        queries.push(supabase.from('deals').select('id,lead_id,deal_value,status,created_at'));
      }

      const results = await Promise.all(queries);
      if (!active) return;

      setLeads(results[0].data || []);
      setOpportunities(results[1].data || []);
      setDeals(canSeeDeals ? (results[2]?.data || []) : []);
      setLoading(false);
    };

    load().catch(() => active && setLoading(false));
    return () => { active = false; };
  }, [canSeeDeals]);

  const rows = useMemo(() => {
    return campaigns.map((campaign) => {
      const directLeads = leads.filter((lead) => lead.campaign_id === campaign.id);
      const fallbackLeads = leads.filter((lead) =>
        !lead.campaign_id && lead.lead_source && lead.lead_source.trim().toLowerCase() === String(campaign.name || '').trim().toLowerCase()
      );
      const attributedLeadIds = new Set([...directLeads, ...fallbackLeads].map((lead) => lead.id));

      const campaignOpportunities = opportunities.filter((opportunity) => attributedLeadIds.has(opportunity.lead_id));
      const wonDeals = canSeeDeals
        ? deals.filter((deal) => attributedLeadIds.has(deal.lead_id) && deal.status === 'Won')
        : [];

      const spend = Number(campaign.budget || 0);
      const wonValue = wonDeals.reduce((sum, deal) => sum + Number(deal.deal_value || 0), 0);
      const roas = spend > 0 ? wonValue / spend : null;
      const roi = spend > 0 ? ((wonValue - spend) / spend) * 100 : null;

      return {
        ...campaign,
        directLeadCount: directLeads.length,
        fallbackLeadCount: fallbackLeads.length,
        leadCount: attributedLeadIds.size,
        opportunityCount: campaignOpportunities.length,
        wonDealsCount: wonDeals.length,
        wonValue,
        spend,
        roas,
        roi
      };
    });
  }, [campaigns, deals, leads, opportunities, canSeeDeals]);

  if (loading) return <div style={{ color: '#806f56' }}>جاري تحميل أداء الحملات...</div>;

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0.65rem' }}>
        <div style={card}>
          <div style={{ color: '#806f56', fontSize: '.7rem' }}>إجمالي الحملات</div>
          <strong style={{ display: 'block', color: '#b08a4a', fontSize: '1.25rem', marginTop: 4 }}>{campaigns.length}</strong>
        </div>
        <div style={card}>
          <div style={{ color: '#806f56', fontSize: '.7rem' }}>Leads مرتبطة بحملات</div>
          <strong style={{ display: 'block', color: '#60a5fa', fontSize: '1.25rem', marginTop: 4 }}>{rows.reduce((sum, row) => sum + row.leadCount, 0)}</strong>
        </div>
        <div style={card}>
          <div style={{ color: '#806f56', fontSize: '.7rem' }}>Opportunities</div>
          <strong style={{ display: 'block', color: '#a855f7', fontSize: '1.25rem', marginTop: 4 }}>{rows.reduce((sum, row) => sum + row.opportunityCount, 0)}</strong>
        </div>
        {canSeeDeals && (
          <div style={card}>
            <div style={{ color: '#806f56', fontSize: '.7rem' }}>Won Sales Value</div>
            <strong style={{ display: 'block', color: '#34d399', fontSize: '1.25rem', marginTop: 4 }}>{money(rows.reduce((sum, row) => sum + row.wonValue, 0))} ج</strong>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: '0.7rem' }}>
        {rows.map((row) => (
          <div key={row.id} style={{ ...card, background: '#fffaf0', color: '#3f321f' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '.9rem' }}>{row.name}</div>
                <div style={{ color: '#806f56', fontSize: '.68rem', marginTop: 3 }}>
                  {row.platform || 'منصة غير محددة'} · {row.status || 'Active'}
                </div>
              </div>
              <div style={{ color: '#9a7b4b', fontSize: '.68rem' }}>
                ميزانية: <strong>{money(row.spend)} ج</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 6, marginTop: 10 }}>
              <div><div style={{ color: '#806f56', fontSize: '.63rem' }}>Leads</div><strong>{row.leadCount}</strong></div>
              <div><div style={{ color: '#806f56', fontSize: '.63rem' }}>Opportunities</div><strong>{row.opportunityCount}</strong></div>
              {canSeeDeals && <div><div style={{ color: '#806f56', fontSize: '.63rem' }}>Won</div><strong>{row.wonDealsCount}</strong></div>}
              {canSeeDeals && <div><div style={{ color: '#806f56', fontSize: '.63rem' }}>Won Value</div><strong>{money(row.wonValue)} ج</strong></div>}
              {canSeeDeals && <div><div style={{ color: '#806f56', fontSize: '.63rem' }}>ROAS</div><strong>{row.roas == null ? '—' : row.roas.toFixed(2) + 'x'}</strong></div>}
              {canSeeDeals && <div><div style={{ color: '#806f56', fontSize: '.63rem' }}>ROI</div><strong>{row.roi == null ? '—' : row.roi.toFixed(1) + '%'}</strong></div>}
            </div>

            <div style={{ marginTop: 8, color: '#9a7b4b', fontSize: '.62rem' }}>
              الربط المباشر: {row.directLeadCount} · ربط قديم من Lead Source: {row.fallbackLeadCount}
              {!canSeeDeals && ' · البيانات المالية ظاهرة فقط للمستخدمين المصرح لهم.'}
            </div>
          </div>
        ))}

        {!rows.length && (
          <div style={{ color: '#806f56', padding: '1rem', border: '1px dashed #d9c5a4', borderRadius: 8 }}>
            لا توجد حملات مسجلة حتى الآن.
          </div>
        )}
      </div>
    </div>
  );
}
