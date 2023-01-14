#ifndef CAUSALITY_GRAPH_ANALYSIS_H
#define CAUSALITY_GRAPH_ANALYSIS_H

#include <queue>
#include "model.h"
#include <array>

using namespace std;

class TypeSet
{
public:
    uintptr_t data;

public:
    TypeSet(type_t single_type) : data((((uintptr_t)single_type << 1) | 1))
    {
        assert(data);
    }

    TypeSet(const Bitset* multiple_types) : data(multiple_types->count() == 1 ? (((uintptr_t)multiple_types->first()) << 1) | 1 : (uintptr_t)multiple_types)
    {
        assert(multiple_types);
        assert((((uintptr_t)multiple_types) & 1) == 0);
        assert(data);
    }

    [[nodiscard]] bool is_single_type() const
    {
        return (data & 1) != 0;
    }

    [[nodiscard]] type_t get_single_type() const
    {
        assert(is_single_type());
        return data >> 1;
    }

    bool operator[](size_t i) const
    {
        if(is_single_type())
        {
            return get_single_type() == i;
        }
        else
        {
            const Bitset& bs = *(const Bitset*)data;
            return bs[i];
        }
    }

    [[nodiscard]] size_t count() const
    {
        if(is_single_type())
        {
            return 1;
        }
        else
        {
            const Bitset& bs = *(const Bitset*)data;
            return bs.count();
        }
    }

    [[nodiscard]] type_t first() const
    {
        if(is_single_type())
        {
            return get_single_type();
        }
        else
        {
            const Bitset& bs = *(const Bitset*)data;
            return bs.first();
        }
    }

    [[nodiscard]] type_t next(size_t pos) const
    {
        if(is_single_type())
        {
            return numeric_limits<type_t>::max();
        }
        else
        {
            const Bitset& bs = *(const Bitset*)data;
            return bs.next(pos);
        }
    }
};

struct __attribute__((aligned(64))) TypeflowHistory
{
    static constexpr size_t saturation_cutoff = 20;

    type_t types[saturation_cutoff];
    uint8_t dists[saturation_cutoff];
    uint8_t saturated_dist = numeric_limits<uint8_t>::max();

public:
    TypeflowHistory()
    {
        fill(types, types + saturation_cutoff, numeric_limits<type_t>::max());
        fill(dists, dists + saturation_cutoff, numeric_limits<uint8_t>::max());
    }

    bool add_type(type_t type, uint8_t dist)
    {
        for(size_t i = 0; i < saturation_cutoff; i++)
        {
            if(types[i] == numeric_limits<type_t>::max())
            {
                types[i] = type;
                dists[i] = dist;
                return true;
            }
            else if(types[i] == type)
            {
                return false;
            }
        }

        saturated_dist = dist;
        return true;
    }

    struct iterator
    {
        struct end_it{};

        const TypeflowHistory* parent;
        size_t pos;

        iterator(const TypeflowHistory* parent) : parent(parent), pos(0) {}

        bool operator==(end_it e) const
        {
            return pos == saturation_cutoff || parent->types[pos] == numeric_limits<type_t>::max();
        }

        pair<type_t, uint8_t> operator*() const
        {
            return {parent->types[pos], parent->dists[pos]};
        }

        void operator++()
        {
            pos++;
        }
    };

    iterator begin() const { return { this }; }

    iterator::end_it end() const { return {}; }

    bool is_saturated() const
    {
        return saturated_dist != numeric_limits<uint8_t>::max();
    }

    bool any() const
    {
        return is_saturated() || types[0] != numeric_limits<type_t>::max();
    }
};

static_assert(sizeof(TypeflowHistory) == 64);

class BFS
{
public:
    struct Result
    {
        vector<TypeflowHistory> typeflow_visited;
        vector<uint8_t> method_history;
        vector<bool> method_visited;

        Result(vector<TypeflowHistory>&& typeflow_history, vector<uint8_t>&& method_history, vector<bool>&& method_visited)
        : typeflow_visited(std::move(typeflow_history)),
          method_history(std::move(method_history)),
          method_visited(std::move(method_visited)) {}
    };

    const Adjacency& adj;
    const Bitset* filters_begin;
    vector<TypeSet> filter_filters;
    vector<TypeSet> typeflow_filters;

    explicit BFS(const Adjacency& adj) : adj(adj)
    {
        const Bitset* filters_end;

        {
            auto [f1, f2] = std::minmax_element(adj.flows.begin(), adj.flows.end(), [](const auto& a, const auto& b)
            { return a.filter < b.filter; });

            filters_begin = f1->filter;
            filters_end = f2->filter + 1;
        }

        filter_filters.reserve(filters_end - filters_begin);

        for(size_t i = 0; i < filters_end - filters_begin; i++)
        {
            filter_filters.emplace_back(&filters_begin[i]);
        }

        typeflow_filters.reserve(adj.n_typeflows());

        for(size_t i = 0; i < adj.n_typeflows(); i++)
        {
            size_t filter_index = adj.flows[i].filter - filters_begin;
            typeflow_filters.push_back(filter_filters[filter_index]);
        }
    }

    /* If dist_matters is asigned false, the BFS gets sped up about x2.
     * However, all dist-values of types in typeflows and methods will be zero. */
    template<bool dist_matters = true>
    Result run(span<const method_id> purged_methods = {}) const
    {
        vector<bool> method_visited(adj.n_methods());
        vector<uint8_t> method_history(adj.n_methods(), numeric_limits<uint8_t>::max());
        vector<TypeflowHistory> typeflow_visited(adj.n_typeflows());

        Bitset allInstantiated(adj.n_types());

        method_visited[0] = true;
        method_history[0] = 0;

        for(method_id purged : purged_methods)
            method_visited[purged.id] = true;

        vector<method_id> method_worklist(1, 0);
        vector<method_id> next_method_worklist;
        queue<typeflow_id> typeflow_worklist;

        // Handle white-hole typeflow
        for(auto v: adj.flows[0].forward_edges)
        {
            TypeSet filter = typeflow_filters[v.id];
            bool changed = false;

            for(size_t t = filter.first(); t < adj.n_types(); t = filter.next(t))
            {
                changed |= typeflow_visited[v.id].add_type(t, 0);

                if(typeflow_visited[v.id].is_saturated())
                    break;
            }

            if(changed && !adj[v].method.dependent())
                typeflow_worklist.push(v);
        }

        vector<type_t> instantiated_since_last_iteration;
        vector<list<typeflow_id>> saturation_uses_by_filter(filter_filters.size());
        vector<bool> included_in_saturation_uses(adj.n_typeflows());

        uint8_t dist = 0;

        while(!method_worklist.empty())
        {
            do
            {
                for(method_id u: method_worklist)
                {
                    method_history[u.id] = dist;
                    const auto& m = adj[u];

                    for(auto v: m.dependent_typeflows)
                        if(typeflow_visited[v.id].any())
                            typeflow_worklist.push(v);

                    for(auto v: m.forward_edges)
                    {
                        if(!method_visited[v.id])
                        {
                            method_visited[v.id] = true;
                            next_method_worklist.push_back(v);
                        }
                    }
                }

                method_worklist.clear();
                swap(method_worklist, next_method_worklist);
            }
            while(!dist_matters && !method_worklist.empty());

            if(dist_matters)
                dist++;

            for(;;)
            {
                while(!typeflow_worklist.empty())
                {
                    typeflow_id u = typeflow_worklist.front();
                    typeflow_worklist.pop();

                    method_id reaching = adj[u].method.reaching();

                    if(!method_visited[reaching.id])
                    {
                        method_visited[reaching.id] = true;
                        method_worklist.push_back(reaching);
                    }

                    if(!typeflow_visited[u.id].is_saturated())
                    {
                        for(auto v: adj[u].forward_edges)
                        {
                            if(v == adj.allInstantiated)
                            {
                                for(pair<type_t, uint8_t> type: typeflow_visited[u.id])
                                {
                                    if(!allInstantiated[type.first])
                                    {
                                        allInstantiated[type.first] = true;
                                        instantiated_since_last_iteration.push_back(type.first);
                                    }
                                }
                            }

                            if(typeflow_visited[v.id].is_saturated())
                                continue;

                            TypeSet filter = typeflow_filters[v.id];

                            bool changed = false;

                            for(pair<type_t, uint8_t> type: typeflow_visited[u.id])
                            {
                                if(!filter[type.first])
                                    continue;

                                changed |= typeflow_visited[v.id].add_type(type.first, dist);

                                if(typeflow_visited[v.id].is_saturated())
                                    break;
                            }

                            if(changed && method_history[adj[v].method.dependent().id] != numeric_limits<uint8_t>::max())
                                typeflow_worklist.push(v);
                        }
                    }
                    else
                    {
                        for(auto v: adj[u].forward_edges)
                        {
                            if(typeflow_visited[v.id].is_saturated())
                                continue;

                            if(included_in_saturation_uses[v.id])
                                continue;

                            included_in_saturation_uses[v.id] = true;

                            bool changed = false;

                            TypeSet filter = typeflow_filters[v.id];

                            for(size_t t = filter.first(); t < adj.n_types(); t = filter.next(t))
                            {
                                if(!allInstantiated[t])
                                    continue;

                                changed |= typeflow_visited[v.id].add_type(t, dist);

                                if(typeflow_visited[v.id].is_saturated())
                                    break;
                            }

                            if(!typeflow_visited[v.id].is_saturated())
                                saturation_uses_by_filter[adj[v].filter - filters_begin].push_back(v);

                            if(changed && method_history[adj[v].method.dependent().id] != numeric_limits<uint8_t>::max())
                                typeflow_worklist.push(v);
                        }
                    }
                }

                // Spreading saturation uses is relatively costly, therefore we try to avoid it
                if(!dist_matters && !method_worklist.empty())
                    break;

                if(instantiated_since_last_iteration.empty())
                    break;

                vector<type_t> instantiated_since_last_iteration_filtered;

                for(size_t filter_id = 0; filter_id < filter_filters.size(); filter_id++)
                {
                    auto& saturation_uses = saturation_uses_by_filter[filter_id];

                    if(saturation_uses.empty())
                        continue;

                    for(auto it = saturation_uses.begin(); it != saturation_uses.end();)
                    {
                        typeflow_id v = *it;

                        if(typeflow_visited[v.id].is_saturated())
                        {
                            it = saturation_uses.erase(it);
                        }
                        else
                        {
                            it++;
                        }
                    }

                    if(saturation_uses.empty())
                        continue;

                    TypeSet filter = filter_filters[filter_id];

                    if(filter.count() <= 4)
                    {
                        size_t i = 0;
                        for(type_t type = filter.first();; type = filter.next(type))
                        {
                            if(std::find(instantiated_since_last_iteration.begin(), instantiated_since_last_iteration.end(), type) != instantiated_since_last_iteration.end())
                            {
                                instantiated_since_last_iteration_filtered.push_back(type);
                            }

                            if(++i >= filter.count())
                                break;
                        }
                    }
                    else
                    {
                        for(type_t type: instantiated_since_last_iteration)
                        {
                            if(!filter[type])
                                continue;

                            instantiated_since_last_iteration_filtered.push_back(type);
                        }
                    }

                    if(instantiated_since_last_iteration_filtered.empty())
                    {
                        continue;
                    }

                    auto it = saturation_uses.begin();

                    while(it != saturation_uses.end())
                    {
                        typeflow_id v = *it;

                        if(typeflow_visited[v.id].is_saturated())
                        {
                            it = saturation_uses.erase(it);
                        }
                        else
                        {
                            bool changed = false;

                            for(type_t type : instantiated_since_last_iteration_filtered)
                            {
                                changed |= typeflow_visited[v.id].add_type(type, dist);

                                if(typeflow_visited[v.id].is_saturated())
                                    break;
                            }

                            if(changed && method_history[adj[v].method.dependent().id] != numeric_limits<uint8_t>::max())
                                typeflow_worklist.push(v);

                            it++;
                        }
                    }

                    instantiated_since_last_iteration_filtered.clear();
                }
                instantiated_since_last_iteration.clear();
            }
        }

        for(method_id purged : purged_methods)
            method_visited[purged.id] = false;

        return {std::move(typeflow_visited), std::move(method_history), std::move(method_visited)};
    }
};

#endif //CAUSALITY_GRAPH_ANALYSIS_H
