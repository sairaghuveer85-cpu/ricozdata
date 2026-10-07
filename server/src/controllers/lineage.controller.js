import { LineageService } from '../services/LineageService.js';

export async function createLineage(req, res) {
  const edge = await LineageService.createEdge(req.body, req.organizationId, req.user?._id);
  return res.status(201).json({
    success: true,
    data: edge,
    error: null
  });
}

export async function getDatasetLineage(req, res) {
  const graph = await LineageService.getDatasetLineage(req.params.id, req.organizationId, req.query);
  return res.status(200).json({
    success: true,
    data: graph,
    error: null
  });
}

export async function getUpstreamLineage(req, res) {
  const graph = await LineageService.getUpstream(req.params.id, req.organizationId, req.query);
  return res.status(200).json({
    success: true,
    data: graph,
    error: null
  });
}

export async function getDownstreamLineage(req, res) {
  const graph = await LineageService.getDownstream(req.params.id, req.organizationId, req.query);
  return res.status(200).json({
    success: true,
    data: graph,
    error: null
  });
}

export async function deleteLineage(req, res) {
  const result = await LineageService.deleteEdge(req.params.id, req.organizationId, req.user?._id);
  return res.status(200).json({
    success: true,
    data: result,
    error: null
  });
}
