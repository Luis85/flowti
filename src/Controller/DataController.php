<?php

namespace App\Controller;

use App\Entity\Data;
use App\Form\DataType;
use App\Repository\DataRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/data')]
class DataController extends AbstractController
{
    #[Route('/', name: 'app_data_index', methods: ['GET'])]
    public function index(DataRepository $dataRepository): Response
    {
        return $this->render('data/index.html.twig', [
            'data' => $dataRepository->findAll(),
        ]);
    }

    #[Route('/{id}', name: 'app_data_show', methods: ['GET'])]
    public function show(Data $data): Response
    {
        dump($data);
        return $this->render('data/show.html.twig', [
            'data' => $data,
        ]);
    }

    #[Route('/{id}/edit', name: 'app_data_edit', methods: ['GET', 'POST'])]
    public function edit(Request $request, Data $data, DataRepository $dataRepository): Response
    {
        $form = $this->createForm(DataType::class, $data);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $dataRepository->save($data, true);

            return $this->redirectToRoute('app_data_index', [], Response::HTTP_SEE_OTHER);
        }

        return $this->render('data/edit.html.twig', [
            'data' => $data,
            'form' => $form,
        ]);
    }

    #[Route('/{id}', name: 'app_data_delete', methods: ['POST'])]
    public function delete(Request $request, Data $data, DataRepository $dataRepository): Response
    {
        if ($this->isCsrfTokenValid('delete'.$data->getId(), $request->request->get('_token'))) {
            $data->removeTags();
            $data->setParent(null);

            $children = $dataRepository->findBy(['parent' => $data]);
            foreach ($children as $child) {
                $child->setParent(null);
            }
            $dataRepository->remove($data, true);
        }

        return $this->redirectToRoute('app_data_index', [], Response::HTTP_SEE_OTHER);
    }
}
