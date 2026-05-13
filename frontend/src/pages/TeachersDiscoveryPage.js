import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function TeachersDiscoveryPage() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ subject:'',expertise:'',min_rating:'',max_price:'',language:'',search:'' });

  useEffect(() => { fetchTeachers(); }, [filters]);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k,v]) => { if(v) params.append(k,v); });
      const r = await api.get(`/teachers?${params.toString()}`);
      setTeachers(r.data);
    } catch(e){ console.error(e); } finally { setLoading(false); }
  };

  const handleFilterChange = e => setFilters({...filters,[e.target.name]:e.target.value});
  const clearFilters = () => setFilters({subject:'',expertise:'',min_rating:'',max_price:'',language:'',search:''});

  const inp = "w-full border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500";
  const lbl = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Find a Teacher</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Browse qualified teachers and find the <span className="text-indigo-500 font-medium">perfect match</span> for your learning needs
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-6 mb-6 border border-gray-100 dark:border-gray-700/60">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {n:'search',p:'Search by name, subject, or expertise...'},
              {n:'subject',p:'e.g., Mathematics'},
              {n:'expertise',p:'e.g., Calculus'},
              {n:'max_price',p:'e.g., 50',t:'number'},
              {n:'language',p:'e.g., English'},
            ].map(({n,p,t='text'}) => (
              <div key={n}>
                <label className={lbl}>{n.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</label>
                <input type={t} name={n} value={filters[n]} onChange={handleFilterChange} placeholder={p} className={inp}/>
              </div>
            ))}
            <div>
              <label className={lbl}>Min Rating</label>
              <select name="min_rating" value={filters.min_rating} onChange={handleFilterChange} className={inp}>
                <option value="">Any Rating</option>
                {['4.5','4.0','3.5','3.0'].map(v=><option key={v} value={v}>{v}+ Stars</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={clearFilters} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Clear Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">Loading teachers...</div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 shadow rounded-xl border border-gray-100 dark:border-gray-700/60">
            <div className="text-xl text-gray-600 dark:text-gray-300">No teachers found</div>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.map(teacher => (
              <div key={teacher.id}
                className="bg-white dark:bg-gray-800 shadow rounded-xl overflow-hidden hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all cursor-pointer border border-gray-100 dark:border-gray-700/60 hover:border-indigo-200 dark:hover:border-indigo-700/50"
                onClick={() => navigate(`/teachers/${teacher.id}`)}>
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    {teacher.profile_picture ? (
                      <img src={teacher.profile_picture} alt={teacher.full_name} className="h-16 w-16 rounded-full object-cover"/>
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <span className="text-2xl text-indigo-600 dark:text-indigo-400 font-semibold">{teacher.full_name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="ml-4 flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{teacher.full_name}</h3>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <span className="text-yellow-500">⭐</span>
                        <span className="ml-1">{teacher.average_rating.toFixed(1)} ({teacher.total_reviews} reviews)</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {teacher.short_bio || 'Experienced teacher ready to help you succeed!'}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {teacher.areas_of_expertise.slice(0,3).map((e,i) => (
                      <span key={i} className="px-2 py-1 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">{e}</span>
                    ))}
                    {teacher.areas_of_expertise.length > 3 && (
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">+{teacher.areas_of_expertise.length-3} more</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Experience</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{teacher.years_of_experience} years</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Students</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{teacher.total_students}</div>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">${teacher.hourly_rate}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">/hour</span>
                    </div>
                    <button onClick={e=>{e.stopPropagation();navigate(`/teachers/${teacher.id}`);}}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                      View Profile
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
